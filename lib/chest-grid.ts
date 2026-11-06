// Lógica pura de la pestaña de cofres. Client-safe: solo tipos y módulos puros, sin SQLite.
import { chestTierOdds, type Rarity, type TierOdds, tierOf } from './rewards';
import { effectiveKeyCostUnits } from './settings-store';

export const CHEAP_CHEST_MAX_UNITS = 500;
export const MIN_OPENED_CHESTS = 3;
export const SECTION_SIZE = 4;
export const GRID_PAGE_SIZE = 24;
export const FEW_SKINS_MAX = 5;

const MIN_SEGMENT_PCT = 2;

export type GridChest = {
  id: string;
  name: string;
  xp_cost: number;
  type: 'chest';
  requires_key: number;
  hasRareDrop?: boolean;
};

export type ChestOpens = { chestId: string; opens: number; lastOpenedAt: string };
export type SectionId = 'opened' | 'rare' | 'cheap';

// A mano y no con Intl, como formatXp: se renderiza en cliente y servidor. Una cifra menor a
// 10 lleva un decimal (1,5%), el resto entero (79%).
export function formatPercent(value: number): string {
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${String(rounded).replace('.', ',')}%`;
}

export function chestOpenCostUnits(chest: GridChest, keyCostXpUnits: number): number {
  return chest.xp_cost + effectiveKeyCostUnits(chest, keyCostXpUnits);
}

const SECTION_TITLES: Record<SectionId, string> = {
  opened: 'Las que abriste',
  rare: 'Con cuchillo o guante',
  cheap: 'Baratas',
};

function byCost(keyCost: number) {
  return (a: GridChest, b: GridChest) =>
    chestOpenCostUnits(a, keyCost) - chestOpenCostUnits(b, keyCost) ||
    a.name.localeCompare(b.name, 'es');
}

// Todas las que abriste, de más a menos abiertas y, a igual cantidad, la más reciente primero.
function openedChests(chests: GridChest[], opens: ChestOpens[]): GridChest[] {
  const byId = new Map(chests.map((c) => [c.id, c]));
  return opens
    .filter((o) => byId.has(o.chestId))
    .sort((a, b) => b.opens - a.opens || b.lastOpenedAt.localeCompare(a.lastOpenedAt))
    .map((o) => byId.get(o.chestId) as GridChest);
}

function sectionChests(
  id: SectionId,
  chests: GridChest[],
  opens: ChestOpens[],
  keyCost: number
): GridChest[] {
  if (id === 'opened') return openedChests(chests, opens);
  if (id === 'rare') return chests.filter((c) => c.hasRareDrop).sort(byCost(keyCost));
  return chests
    .filter((c) => chestOpenCostUnits(c, keyCost) <= CHEAP_CHEST_MAX_UNITS)
    .sort(byCost(keyCost));
}

export function buildChestSections(
  chests: GridChest[],
  opens: ChestOpens[],
  keyCostXpUnits: number
): { id: SectionId; title: string; chests: GridChest[]; total: number }[] {
  return (['opened', 'rare', 'cheap'] as const)
    .map((id) => {
      let all = sectionChests(id, chests, opens, keyCostXpUnits);
      if (id === 'opened' && all.length < MIN_OPENED_CHESTS) all = [];
      return {
        id,
        title: SECTION_TITLES[id],
        chests: all.slice(0, SECTION_SIZE),
        total: all.length,
      };
    })
    .filter((s) => s.total > 0);
}

export function filterChests(
  chests: GridChest[],
  q: {
    search: string;
    maxUnits: number | null;
    rareOnly: boolean;
    section: SectionId | null;
    sort: 'cost' | 'name';
  },
  keyCostXpUnits: number,
  opens: ChestOpens[]
): GridChest[] {
  const needle = q.search.trim().toLowerCase();
  let list = q.section ? sectionChests(q.section, chests, opens, keyCostXpUnits) : chests;
  list = list.filter(
    (c) =>
      (!needle || c.name.toLowerCase().includes(needle)) &&
      (q.maxUnits === null || chestOpenCostUnits(c, keyCostXpUnits) <= q.maxUnits) &&
      (!q.rareOnly || c.hasRareDrop)
  );
  return [...list].sort(
    q.sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'es') : byCost(keyCostXpUnits)
  );
}

export function tierSegments(
  odds: TierOdds[]
): { rarity: Rarity; percent: number; widthPct: number }[] {
  const total = odds.reduce((sum, o) => sum + o.percent, 0);
  if (total <= 0) return [];
  const segs = odds.map((o) => ({
    rarity: o.rarity,
    percent: o.percent,
    widthPct: Math.max(MIN_SEGMENT_PCT, (o.percent / total) * 100),
  }));
  const excess = segs.reduce((sum, s) => sum + s.widthPct, 0) - 100;
  if (Math.abs(excess) > 1e-9) {
    const widest = segs.reduce((a, b) => (b.widthPct > a.widthPct ? b : a));
    widest.widthPct -= excess;
  }
  return segs;
}

export function tierAriaLabel(odds: TierOdds[], labels: Record<Rarity, string>): string {
  return odds.map((o) => `${labels[o.rarity]} ${formatPercent(o.percent)}`).join(', ');
}

export type PricedItem = { name: string; rarity: string | null; usd: number; isFallback: boolean };

export type ChestPriceSummary = {
  best: { name: string; usdUnits: number; isFallback: boolean } | null;
  evRatio: number | null;
  marketCount: number;
  itemCount: number;
};

const toUnits = (usd: number) => Math.round(usd * 100);

// El EV usa el promedio uniforme dentro de cada tier porque así sortea `pickChestItem`. Solo
// se calcula si al menos la mitad de las skins tiene precio de mercado: con menos, los
// fallback (cuchillos a $120) dominan la cifra y la Fracture Case daba 185%, un número que
// parece de mercado y sale del modelo de fallback. Además cada tier presente necesita al
// menos un precio de mercado: si no, el tier ★ puede salir entero de precios de fallback.
export function summarizeChestPrices(
  items: PricedItem[],
  openCostUnits: number
): ChestPriceSummary {
  const marketCount = items.filter((i) => !i.isFallback).length;
  const top = [...items].sort((a, b) => b.usd - a.usd || a.name.localeCompare(b.name, 'es'))[0];
  const best = top
    ? { name: top.name, usdUnits: toUnits(top.usd), isFallback: top.isFallback }
    : null;
  const tierOfItem = (i: PricedItem) => tierOf({ id: '', name: '', rarity: i.rarity as Rarity });
  const allTiers = new Set(items.map(tierOfItem));
  const marketTiers = new Set(items.filter((i) => !i.isFallback).map(tierOfItem));
  if (
    marketCount === 0 ||
    marketCount * 2 < items.length ||
    marketTiers.size < allTiers.size ||
    openCostUnits <= 0
  ) {
    return { best, evRatio: null, marketCount, itemCount: items.length };
  }
  const byTier = new Map<Rarity, number[]>();
  for (const i of items) {
    const tier = tierOfItem(i);
    byTier.set(tier, [...(byTier.get(tier) ?? []), toUnits(i.usd)]);
  }
  const ev = chestTierOdds(items.map((i) => i.rarity)).reduce((sum, { rarity, percent }) => {
    const units = byTier.get(rarity) ?? [];
    const avg = units.reduce((a, b) => a + b, 0) / units.length;
    return sum + (percent / 100) * avg;
  }, 0);
  return { best, evRatio: ev / openCostUnits, marketCount, itemCount: items.length };
}
