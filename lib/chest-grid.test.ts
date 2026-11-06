import { describe, expect, it } from 'vitest';
import {
  buildChestSections,
  chestOpenCostUnits,
  filterChests,
  type GridChest,
  summarizeChestPrices,
  tierAriaLabel,
  tierSegments,
} from './chest-grid';
import { chestTierOdds } from './rewards';

const KEY = 249;
const chest = (id: string, xp_cost: number, extra: Partial<GridChest> = {}): GridChest => ({
  id,
  name: id,
  xp_cost,
  type: 'chest',
  requires_key: 0,
  ...extra,
});
const open = (chestId: string, opens: number, lastOpenedAt = '2026-01-01') => ({
  chestId,
  opens,
  lastOpenedAt,
});

describe('chestOpenCostUnits', () => {
  it('suma la llave solo si la caja la requiere', () => {
    expect(chestOpenCostUnits(chest('a', 150, { requires_key: 1 }), KEY)).toBe(399);
    expect(chestOpenCostUnits(chest('b', 150), KEY)).toBe(150);
  });
});

describe('buildChestSections', () => {
  it('opened aparece solo con 3 o más cajas distintas', () => {
    const chests = ['a', 'b', 'c'].map((id) => chest(id, 9000));
    const ids = (n: number) =>
      buildChestSections(
        chests,
        chests.slice(0, n).map((c) => open(c.id, 1)),
        KEY
      ).map((s) => s.id);
    expect(ids(2)).not.toContain('opened');
    expect(ids(3)).toContain('opened');
  });

  it('cheap incluye 500 exactas y excluye 501', () => {
    const s = buildChestSections([chest('a', 500), chest('b', 501)], [], KEY);
    expect(s).toHaveLength(1);
    expect(s[0].chests.map((c) => c.id)).toEqual(['a']);
  });

  it('limita a 4 cajas y total cuenta todas', () => {
    const chests = Array.from({ length: 6 }, (_, i) =>
      chest(`r${i}`, 9000 + i, { hasRareDrop: true })
    );
    const rare = buildChestSections(chests, [], KEY).find((s) => s.id === 'rare');
    expect(rare?.chests).toHaveLength(4);
    expect(rare?.total).toBe(6);
  });

  it('ordena opened por opens desc y luego lastOpenedAt desc', () => {
    const chests = ['a', 'b', 'c', 'd'].map((id) => chest(id, 9000));
    const s = buildChestSections(
      chests,
      [
        open('a', 1, '2026-03-01'),
        open('b', 5, '2026-01-01'),
        open('c', 1, '2026-05-01'),
        open('d', 2),
      ],
      KEY
    ).find((x) => x.id === 'opened');
    expect(s?.chests.map((c) => c.id)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('omite secciones vacías y respeta el orden', () => {
    const chests = [chest('a', 100, { hasRareDrop: true })];
    expect(buildChestSections(chests, [], KEY).map((s) => s.id)).toEqual(['rare', 'cheap']);
    expect(buildChestSections([chest('z', 9000)], [], KEY)).toEqual([]);
  });
});

describe('filterChests', () => {
  const base = {
    search: '',
    maxUnits: null,
    rareOnly: false,
    section: null,
    sort: 'cost' as const,
  };
  const chests = [
    chest('Kilowatt Case', 65, { requires_key: 1 }),
    chest('Zeta', 100),
    chest('Alfa', 100),
  ];

  it('busca con trim e ignorando mayúsculas', () => {
    expect(filterChests(chests, { ...base, search: '  KILO ' }, KEY, []).map((c) => c.id)).toEqual([
      'Kilowatt Case',
    ]);
  });

  it('maxUnits null no filtra y un número filtra por costo de abrir', () => {
    expect(filterChests(chests, base, KEY, [])).toHaveLength(3);
    expect(filterChests(chests, { ...base, maxUnits: 100 }, KEY, []).map((c) => c.id)).toEqual([
      'Alfa',
      'Zeta',
    ]);
  });

  it('sort cost desempata por nombre; sort name usa es', () => {
    expect(filterChests(chests, base, KEY, []).map((c) => c.id)).toEqual([
      'Alfa',
      'Zeta',
      'Kilowatt Case',
    ]);
    expect(filterChests(chests, { ...base, sort: 'name' }, KEY, []).map((c) => c.id)).toEqual([
      'Alfa',
      'Kilowatt Case',
      'Zeta',
    ]);
  });

  it('section opened y rareOnly', () => {
    const cs = [chest('a', 9000, { hasRareDrop: true }), chest('b', 9000)];
    expect(
      filterChests(cs, { ...base, section: 'opened' }, KEY, [open('b', 1)]).map((c) => c.id)
    ).toEqual(['b']);
    expect(filterChests(cs, { ...base, rareOnly: true }, KEY, []).map((c) => c.id)).toEqual(['a']);
  });
});

describe('tierSegments', () => {
  it('garantiza 2% al segmento presente y suma 100', () => {
    const seg = tierSegments([
      { rarity: 'common', percent: 80 },
      { rarity: 'rare', percent: 16 },
      { rarity: 'epic', percent: 3.2 },
      { rarity: 'legendary', percent: 0.8 },
    ]);
    expect(seg.reduce((s, x) => s + x.widthPct, 0)).toBeCloseTo(100);
    expect(seg.find((x) => x.rarity === 'legendary')?.widthPct).toBe(2);
  });

  it('un solo tier mide 100', () => {
    expect(tierSegments([{ rarity: 'rare', percent: 100 }]).map((x) => x.widthPct)).toEqual([100]);
  });
});

describe('tierAriaLabel', () => {
  it('formatea con coma decimal', () => {
    const labels = { common: 'Común', rare: 'Rara', epic: 'Épica', legendary: '★' };
    expect(
      tierAriaLabel(
        [
          { rarity: 'common', percent: 79.9 },
          { rarity: 'rare', percent: 16 },
          { rarity: 'epic', percent: 3.2 },
          { rarity: 'legendary', percent: 0.9 },
        ],
        labels
      )
    ).toBe('Común 80%, Rara 16%, Épica 3,2%, ★ 0,9%');
  });
});

describe('summarizeChestPrices', () => {
  const item = (name: string, rarity: string, usd: number, isFallback = false) => ({
    name,
    rarity,
    usd,
    isFallback,
  });

  it('calcula el retorno esperado por tier con promedio uniforme', () => {
    const odds = chestTierOdds(['common', 'common', 'rare']);
    const p = (r: string) => (odds.find((o) => o.rarity === r)?.percent ?? 0) / 100;
    const s = summarizeChestPrices(
      [item('A', 'common', 1), item('B', 'common', 1), item('C', 'rare', 10)],
      400
    );
    expect(s.evRatio).toBeCloseTo((p('common') * 100 + p('rare') * 1000) / 400, 10);
    expect(s.best).toEqual({ name: 'C', usdUnits: 1000, isFallback: false });
    expect(s.marketCount).toBe(3);
    expect(s.itemCount).toBe(3);
  });

  it('sin precios de mercado no hay retorno y el mejor premio es estimado', () => {
    const s = summarizeChestPrices([item('A', 'common', 1, true), item('B', 'rare', 5, true)], 400);
    expect(s.evRatio).toBeNull();
    expect(s.best?.isFallback).toBe(true);
    expect(s.marketCount).toBe(0);
  });

  it('el retorno exige precio de mercado en al menos la mitad de la caja', () => {
    const one = summarizeChestPrices(
      [item('A', 'common', 1), item('B', 'common', 1, true), item('C', 'legendary', 120, true)],
      400
    );
    expect(one.marketCount).toBe(1);
    expect(one.evRatio).toBeNull();
    const two = summarizeChestPrices(
      [item('A', 'common', 1), item('B', 'common', 1), item('C', 'legendary', 120, true)],
      400
    );
    expect(two.evRatio).toEqual(expect.any(Number));
  });

  it('una lista vacia da best null y un costo no positivo da evRatio null', () => {
    expect(summarizeChestPrices([], 400)).toEqual({
      best: null,
      evRatio: null,
      marketCount: 0,
      itemCount: 0,
    });
    expect(summarizeChestPrices([item('A', 'common', 1)], 0).evRatio).toBeNull();
  });

  it('desempata el mejor premio por nombre', () => {
    const s = summarizeChestPrices([item('B', 'rare', 5), item('A', 'common', 5)], 100);
    expect(s.best?.name).toBe('A');
  });
});
