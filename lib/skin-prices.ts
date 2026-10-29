import type { Db } from './db';

/**
 * Steam cotiza por desgaste: `MP7 | Skulls` no existe como artículo del mercado y
 * devuelve `{"success":true}` sin precio, mientras que `MP7 | Skulls (Field-Tested)`
 * devuelve $16,07 (verificado el 2026-08-13 contra `priceoverview`).
 *
 * El catálogo del proyecto guarda las skins agrupadas, sin desgaste, así que no hay un
 * precio único que corresponda a lo que el usuario tiene. Se consulta en este orden y se
 * usa el primero que cotice: Field-Tested es el más líquido, y de ahí se baja por
 * frecuencia. El desgaste que dio precio se guarda para que la UI pueda decir de cuál
 * habla en vez de mostrar un número sin origen.
 *
 * El valor es de referencia, no un registro del canje: no dice cuánto valía el día que te
 * tocó, dice cuánto cotiza esa skin ahora.
 */
export const WEARS = ['Field-Tested', 'Minimal Wear', 'Well-Worn', 'Factory New', 'Battle-Scarred'];

/**
 * Los cuchillos del preset vienen como familia sin acabado (`★ Bayonet`), y resulta que
 * Steam los cotiza **exactamente así**: `★ Bayonet` devuelve $380,01, mientras que
 * `★ Bayonet (Field-Tested)` no devuelve nada (verificado el 2026-08-13). Son los
 * cuchillos vanilla, que se comercian sin desgaste en el nombre.
 *
 * Justo al revés que las skins de arma. De ahí que la consulta dependa de la forma del
 * nombre y no de la rareza.
 */
export function priceQueryNames(name: string): string[] {
  if (name.includes('|')) return WEARS.map((wear) => `${name} (${wear})`);
  return [name];
}

export interface PriceLookup {
  usd: number | null;
  wear: string | null;
  /** Si la respuesta alcanza para concluir algo. Ver abajo. */
  confirmed: boolean;
  requests: number;
}

/**
 * Prueba los candidatos hasta que uno cotice, sin pasarse de `budget` peticiones.
 *
 * `confirmed` es false cuando no se llegó a una conclusión: falló la petición, o el techo
 * cortó la lista a medias. Ahí el precio guardado no se toca. Guardar ese null como "no
 * cotiza" dejaba la skin sin precio por los 7 días enteros del stale por una caída
 * momentánea de Steam, y encima consumía el techo de la próxima corrida en otra cosa.
 *
 * Recibe el fetcher en vez de llamar a `fetch`: el espaciado entre peticiones es política
 * de la ruta, y así esto se prueba sin red.
 */
export async function resolveSkinPrice(
  name: string,
  budget: number,
  fetchPrice: (queryName: string) => Promise<number | null>
): Promise<PriceLookup> {
  const miss = (requests: number): PriceLookup => ({
    usd: null,
    wear: null,
    confirmed: false,
    requests,
  });
  let requests = 0;

  for (const queryName of priceQueryNames(name)) {
    if (requests >= budget) return miss(requests);
    requests++;

    let usd: number | null;
    try {
      usd = await fetchPrice(queryName);
    } catch {
      return miss(requests);
    }

    if (usd !== null) return { usd, wear: wearOf(queryName, name), confirmed: true, requests };
  }

  // Todos los candidatos respondieron y ninguno cotiza: eso sí es una conclusión, y se
  // guarda para no volver a gastar el techo en los mismos nombres.
  return { usd: null, wear: null, confirmed: true, requests };
}

export function isPriceable(name: string): boolean {
  return name.includes('|') || name.startsWith('★');
}

/** El desgaste que dio precio, o null cuando la consulta fue el nombre pelado. */
export function wearOf(queryName: string, name: string): string | null {
  if (queryName === name) return null;
  const match = /\(([^)]+)\)$/.exec(queryName);
  return match ? match[1] : null;
}

export interface SkinPrice {
  name: string;
  usd: number | null;
  wear: string | null;
  fetched_at: string;
}

export function getSkinPrices(db: Db, names: string[]): Map<string, SkinPrice> {
  if (names.length === 0) return new Map();

  const placeholders = names.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT name, usd, wear, fetched_at FROM skin_prices WHERE name IN (${placeholders})`)
    .all(...names) as SkinPrice[];

  return new Map(rows.map((row) => [row.name, row]));
}

export function setSkinPrice(db: Db, name: string, usd: number | null, wear: string | null): void {
  db.prepare(
    `INSERT INTO skin_prices (name, usd, wear, fetched_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(name) DO UPDATE SET usd = excluded.usd, wear = excluded.wear, fetched_at = excluded.fetched_at`
  ).run(name, usd, wear);
}

const STALE_DAYS = 7;

export function isStale(price: SkinPrice | undefined): boolean {
  if (!price?.fetched_at) return true;
  const normalized = price.fetched_at.endsWith('Z')
    ? price.fetched_at
    : `${price.fetched_at.replace(' ', 'T')}Z`;
  const age = Date.now() - new Date(normalized).getTime();
  return !Number.isFinite(age) || age > STALE_DAYS * 24 * 60 * 60 * 1000;
}

export const TIER_FALLBACK_USD: Record<string, number> = {
  common: 0.5,
  rare: 2.0,
  epic: 15.0,
  legendary: 80.0,
  special: 120.0, // Cuchillos y guantes con ★
};

export const WEAPON_MULTIPLIERS: [RegExp, number][] = [
  // Cuchillos y guantes de alta gama
  [/(Butterfly Knife|Karambit|M9 Bayonet)/i, 5.0],
  [/(Talon Knife|Skeleton Knife|Nomad Knife|Stiletto Knife)/i, 3.2],
  [/(Bayonet|Flip Knife|Ursus Knife|Classic Knife|Huntsman Knife|Bowie Knife)/i, 2.0],
  [/(Gut Knife|Navaja Knife|Shadow Daggers|Falchion Knife|Survival Knife|Paracord Knife)/i, 1.1],
  [/(Sport Gloves|Specialist Gloves)/i, 3.8],
  [
    /(Driver Gloves|Moto Gloves|Hand Wraps|Hydra Gloves|Broken Fang Gloves|Bloodhound Gloves)/i,
    1.8,
  ],

  // Rifles y francotiradores meta
  [/AWP/i, 2.2],
  [/AK-47/i, 1.9],
  [/M4A1-S/i, 1.6],
  [/M4A4/i, 1.35],
  [/Desert Eagle/i, 1.25],
  [/USP-S/i, 1.2],
  [/Glock-18/i, 1.1],
  [/(Galil AR|FAMAS|SSG 08|SG 553|AUG)/i, 0.95],

  // SMGs
  [/(MP9|MAC-10|P90)/i, 0.85],
  [/(MP7|UMP-45|PP-Bizon|MP5-SD)/i, 0.75],

  // Pistolas secundarias y escopetas / pesadas
  [/(P250|Five-SeveN|Tec-9|CZ75-Auto)/i, 0.75],
  [/(Dual Berettas|R8 Revolver)/i, 0.65],
  [/(XM1014|MAG-7|Nova|Sawed-Off)/i, 0.55],
  [/(M249|Negev)/i, 0.45],
];

export function getWeaponMultiplier(name: string): number {
  for (const [pattern, mult] of WEAPON_MULTIPLIERS) {
    if (pattern.test(name)) return mult;
  }
  return 1.0;
}

export function hashSkinName(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Motor Algorítmico Granular por Ítem (Estándar CSGORoll / Hellcase)
 * Da a cada skin un precio determinista al centavo que varia por arma y por nombre, asi que
 * dos skins del mismo tier casi nunca empatan. Casi: la variacion tiene 1.000 escalones y se
 * redondea al centavo, de modo que dos nombres pueden coincidir. Los empates que queden los
 * resuelve el desempate de executeCaseBattle (lib/case-battle.ts).
 */
export function getDeterministicSkinPrice(name: string, rarity?: string | null): number {
  const isSpecial = name.startsWith('★') || name.includes('★');
  const key = (rarity ?? 'common').toLowerCase();

  let baseUsd = TIER_FALLBACK_USD[key] ?? TIER_FALLBACK_USD.common;
  if (isSpecial) {
    baseUsd = TIER_FALLBACK_USD.special;
  }

  const weaponMult = getWeaponMultiplier(name);
  const h = hashSkinName(name);
  const entropy = 0.82 + ((h % 1000) / 1000) * 0.42;

  const raw = baseUsd * weaponMult * entropy;
  return Math.max(0.05, Math.round(raw * 100) / 100);
}

export function getTierFallbackPrice(rarity?: string | null, name?: string | null): number {
  if (name && (name.startsWith('★') || name.includes('★'))) {
    return TIER_FALLBACK_USD.special;
  }
  const key = (rarity ?? 'common').toLowerCase();
  return TIER_FALLBACK_USD[key] ?? TIER_FALLBACK_USD.common;
}

export interface ResolvedSkinPrice {
  usd: number;
  wear: string | null;
  isFallback: boolean;
  isStale: boolean;
}

// Un solo fallback para todos los lectores. Era opcional, y el inventario mostraba el
// determinista mientras la venta pagaba el fijo por tier: el boton decia un monto y se
// acreditaba otro.
export function resolvePriceWithFallback(
  cachedPrice: SkinPrice | undefined,
  rarity?: string | null,
  name?: string | null
): ResolvedSkinPrice {
  if (
    cachedPrice &&
    cachedPrice.usd !== null &&
    Number.isFinite(cachedPrice.usd) &&
    cachedPrice.usd > 0
  ) {
    return {
      usd: cachedPrice.usd,
      wear: cachedPrice.wear,
      isFallback: false,
      isStale: isStale(cachedPrice),
    };
  }
  const fallbackUsd = name ? getDeterministicSkinPrice(name, rarity) : getTierFallbackPrice(rarity);
  return {
    usd: fallbackUsd,
    wear: null,
    isFallback: true,
    isStale: true,
  };
}

export function getSkinPriceOrFallback(
  db: Db,
  name: string,
  rarity?: string | null
): ResolvedSkinPrice {
  const row = db
    .prepare('SELECT name, usd, wear, fetched_at FROM skin_prices WHERE name = ?')
    .get(name) as SkinPrice | undefined;
  return resolvePriceWithFallback(row, rarity, name);
}

/**
 * Precios de referencia de mercado para 143 skins populares en CS2.
 * Permite sembrado instantáneo sin red ni dependencias externas.
 */
export const POPULAR_SKIN_PRICES: Record<string, { usd: number; wear: string | null }> = {
  // AK-47
  'AK-47 | Redline': { usd: 14.5, wear: 'Field-Tested' },
  'AK-47 | Slate': { usd: 2.8, wear: 'Field-Tested' },
  'AK-47 | Ice Coaled': { usd: 7.2, wear: 'Field-Tested' },
  'AK-47 | Asiimov': { usd: 34.0, wear: 'Field-Tested' },
  'AK-47 | Vulcan': { usd: 340.0, wear: 'Field-Tested' },
  'AK-47 | Case Hardened': { usd: 245.0, wear: 'Field-Tested' },
  'AK-47 | Frontside Misty': { usd: 16.5, wear: 'Field-Tested' },
  'AK-47 | Neon Rider': { usd: 48.0, wear: 'Field-Tested' },
  'AK-47 | Legion of Anubis': { usd: 12.0, wear: 'Field-Tested' },
  'AK-47 | Phantom Disruptor': { usd: 6.8, wear: 'Field-Tested' },
  'AK-47 | Safari Mesh': { usd: 0.12, wear: 'Field-Tested' },
  'AK-47 | Uncharted': { usd: 0.45, wear: 'Field-Tested' },
  'AK-47 | Elite Build': { usd: 1.8, wear: 'Field-Tested' },
  'AK-47 | Blue Laminate': { usd: 11.5, wear: 'Field-Tested' },
  'AK-47 | Red Laminate': { usd: 38.0, wear: 'Field-Tested' },
  'AK-47 | Point Disarray': { usd: 18.0, wear: 'Field-Tested' },
  'AK-47 | The Empress': { usd: 32.0, wear: 'Field-Tested' },
  'AK-47 | Nightwish': { usd: 9.5, wear: 'Field-Tested' },
  'AK-47 | Head Shot': { usd: 13.5, wear: 'Field-Tested' },
  'AK-47 | Inheritance': { usd: 65.0, wear: 'Field-Tested' },

  // AWP
  'AWP | Atheris': { usd: 3.2, wear: 'Field-Tested' },
  'AWP | Duality': { usd: 3.5, wear: 'Field-Tested' },
  'AWP | Asiimov': { usd: 95.0, wear: 'Field-Tested' },
  'AWP | Neo-Noir': { usd: 28.0, wear: 'Field-Tested' },
  'AWP | Hyper Beast': { usd: 26.5, wear: 'Field-Tested' },
  'AWP | Mortis': { usd: 2.2, wear: 'Field-Tested' },
  'AWP | Worm God': { usd: 1.5, wear: 'Field-Tested' },
  'AWP | PAW': { usd: 1.8, wear: 'Field-Tested' },
  'AWP | Wildfire': { usd: 55.0, wear: 'Field-Tested' },
  'AWP | Chromatic Aberration': { usd: 8.5, wear: 'Field-Tested' },
  'AWP | Electric Hive': { usd: 62.0, wear: 'Field-Tested' },
  'AWP | BOOM': { usd: 88.0, wear: 'Field-Tested' },
  'AWP | Lightning Strike': { usd: 420.0, wear: 'Factory New' },
  'AWP | Graphite': { usd: 195.0, wear: 'Factory New' },
  'AWP | Containment Breach': { usd: 68.0, wear: 'Field-Tested' },
  'AWP | Fever Dream': { usd: 8.0, wear: 'Field-Tested' },

  // M4A4
  'M4A4 | The Emperor': { usd: 16.0, wear: 'Field-Tested' },
  'M4A4 | Spider Lily': { usd: 3.5, wear: 'Field-Tested' },
  'M4A4 | Desolate Space': { usd: 6.5, wear: 'Field-Tested' },
  'M4A4 | Neo-Noir': { usd: 14.0, wear: 'Field-Tested' },
  'M4A4 | In Living Color': { usd: 7.5, wear: 'Field-Tested' },
  'M4A4 | Tooth Fairy': { usd: 3.0, wear: 'Field-Tested' },
  'M4A4 | Magnesium': { usd: 0.35, wear: 'Field-Tested' },
  'M4A4 | Evil Daimyo': { usd: 3.2, wear: 'Field-Tested' },
  'M4A4 | Griffin': { usd: 2.5, wear: 'Field-Tested' },
  'M4A4 | Dragon King': { usd: 10.5, wear: 'Field-Tested' },
  'M4A4 | Hellfire': { usd: 52.0, wear: 'Field-Tested' },
  'M4A4 | Buzz Kill': { usd: 11.0, wear: 'Field-Tested' },
  'M4A4 | Temukau': { usd: 15.0, wear: 'Field-Tested' },
  'M4A4 | Cyber Security': { usd: 18.0, wear: 'Field-Tested' },
  'M4A4 | Etch Lord': { usd: 1.8, wear: 'Field-Tested' },

  // M4A1-S
  'M4A1-S | Printstream': { usd: 145.0, wear: 'Field-Tested' },
  'M4A1-S | Hyper Beast': { usd: 18.0, wear: 'Field-Tested' },
  'M4A1-S | Decimator': { usd: 14.5, wear: 'Field-Tested' },
  'M4A1-S | Cyrex': { usd: 22.0, wear: 'Field-Tested' },
  'M4A1-S | Player Two': { usd: 21.0, wear: 'Field-Tested' },
  'M4A1-S | Nightmare': { usd: 16.0, wear: 'Field-Tested' },
  'M4A1-S | Leaded Glass': { usd: 7.0, wear: 'Field-Tested' },
  'M4A1-S | Basilisk': { usd: 8.5, wear: 'Field-Tested' },
  'M4A1-S | Flashback': { usd: 1.5, wear: 'Field-Tested' },
  'M4A1-S | Emphorosaur-S': { usd: 0.85, wear: 'Field-Tested' },
  'M4A1-S | Night Terror': { usd: 0.95, wear: 'Field-Tested' },
  'M4A1-S | Black Lotus': { usd: 14.0, wear: 'Field-Tested' },

  // Desert Eagle
  'Desert Eagle | Printstream': { usd: 42.0, wear: 'Field-Tested' },
  'Desert Eagle | Code Red': { usd: 24.0, wear: 'Field-Tested' },
  'Desert Eagle | Mecha Industries': { usd: 6.8, wear: 'Field-Tested' },
  'Desert Eagle | Conspiracy': { usd: 7.5, wear: 'Field-Tested' },
  'Desert Eagle | Kumicho Dragon': { usd: 19.0, wear: 'Field-Tested' },
  'Desert Eagle | Light Rail': { usd: 2.2, wear: 'Field-Tested' },
  'Desert Eagle | Trigger Discipline': { usd: 0.85, wear: 'Field-Tested' },
  'Desert Eagle | Blue Ply': { usd: 0.35, wear: 'Field-Tested' },
  'Desert Eagle | Corinthian': { usd: 0.45, wear: 'Field-Tested' },
  'Desert Eagle | Ocean Drive': { usd: 16.5, wear: 'Field-Tested' },

  // USP-S
  'USP-S | Printstream': { usd: 45.0, wear: 'Field-Tested' },
  'USP-S | Kill Confirmed': { usd: 140.0, wear: 'Field-Tested' },
  'USP-S | Cortex': { usd: 4.8, wear: 'Field-Tested' },
  'USP-S | Neo-Noir': { usd: 16.0, wear: 'Field-Tested' },
  'USP-S | Cyrex': { usd: 2.5, wear: 'Field-Tested' },
  'USP-S | Flashback': { usd: 0.75, wear: 'Field-Tested' },
  'USP-S | Ticket to Hell': { usd: 0.65, wear: 'Field-Tested' },
  'USP-S | Black Lotus': { usd: 2.2, wear: 'Field-Tested' },
  'USP-S | Jawbreaker': { usd: 11.5, wear: 'Field-Tested' },
  'USP-S | The Traitor': { usd: 11.0, wear: 'Field-Tested' },

  // Glock-18
  'Glock-18 | Water Elemental': { usd: 6.5, wear: 'Field-Tested' },
  'Glock-18 | Vogue': { usd: 4.5, wear: 'Field-Tested' },
  'Glock-18 | Bullet Queen': { usd: 9.0, wear: 'Field-Tested' },
  'Glock-18 | Moonrise': { usd: 1.2, wear: 'Field-Tested' },
  'Glock-18 | High Beam': { usd: 0.95, wear: 'Factory New' },
  'Glock-18 | Clear Polymer': { usd: 0.45, wear: 'Field-Tested' },
  'Glock-18 | Off World': { usd: 0.25, wear: 'Field-Tested' },
  'Glock-18 | Snack Attack': { usd: 3.5, wear: 'Field-Tested' },
  'Glock-18 | Block-18': { usd: 1.1, wear: 'Field-Tested' },

  // Cuchillos Vanilla y populares (★)
  '★ Bayonet': { usd: 380.0, wear: null },
  '★ Karambit': { usd: 1100.0, wear: null },
  '★ M9 Bayonet': { usd: 980.0, wear: null },
  '★ Butterfly Knife': { usd: 1750.0, wear: null },
  '★ Skeleton Knife': { usd: 450.0, wear: null },
  '★ Talon Knife': { usd: 520.0, wear: null },
  '★ Flip Knife': { usd: 260.0, wear: null },
  '★ Huntsman Knife': { usd: 175.0, wear: null },
  '★ Bowie Knife': { usd: 135.0, wear: null },
  '★ Falchion Knife': { usd: 145.0, wear: null },
  '★ Gut Knife': { usd: 120.0, wear: null },
  '★ Shadow Daggers': { usd: 110.0, wear: null },
  '★ Ursus Knife': { usd: 195.0, wear: null },
  '★ Stiletto Knife': { usd: 360.0, wear: null },
  '★ Nomad Knife': { usd: 320.0, wear: null },
  '★ Survival Knife': { usd: 140.0, wear: null },
  '★ Paracord Knife': { usd: 155.0, wear: null },
  '★ Classic Knife': { usd: 240.0, wear: null },
  '★ Navaja Knife': { usd: 95.0, wear: null },
  '★ Kukri Knife': { usd: 310.0, wear: null },
};

export function seedDefaultSkinPrices(db: Db): number {
  const upsert = db.prepare(`
    INSERT INTO skin_prices (name, usd, wear, fetched_at)
    -- Fecha 1970 a proposito: es un precio de referencia, no una cotizacion. Asi isStale lo
    -- marca vencido, la UI lo cuenta como pendiente y el proximo refresco pide el de Steam.
    VALUES (?, ?, ?, '1970-01-01 00:00:00')
    ON CONFLICT(name) DO UPDATE SET
      usd = excluded.usd,
      wear = excluded.wear,
      fetched_at = excluded.fetched_at
    WHERE skin_prices.usd IS NULL OR skin_prices.usd = 0
  `);

  let count = 0;
  db.transaction(() => {
    for (const [name, data] of Object.entries(POPULAR_SKIN_PRICES)) {
      const res = upsert.run(name, data.usd, data.wear);
      if (res.changes > 0) count++;
    }
  })();
  return count;
}

/**
 * `"$16.07"` → `16.07`, `"$1,234.50"` → `1234.5`. Steam devuelve el precio como texto con
 * símbolo y separadores.
 *
 * Asume formato de EE.UU. porque la consulta pide `currency=1`: coma para los miles, punto
 * para los decimales. Tratar la coma como decimal convertía `$1,234.50` en `1.234.50`,
 * que es NaN.
 */
export function parseSteamPrice(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;

  const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  if (cleaned === '') return null; // `Number('')` es 0, no NaN

  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
