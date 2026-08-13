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
  if (!price) return true;
  const age = Date.now() - new Date(`${price.fetched_at.replace(' ', 'T')}Z`).getTime();
  return !Number.isFinite(age) || age > STALE_DAYS * 24 * 60 * 60 * 1000;
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
