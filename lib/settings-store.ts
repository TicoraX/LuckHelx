import type { Db } from './db';
import { toXpUnits } from './xp';

function getMeta(db: Db, key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setMeta(db: Db, key: string, value: string): void {
  db.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

export function getXpBalance(db: Db): number {
  return Number(getMeta(db, 'xp_balance') ?? '0');
}

export function incrementXpBalance(db: Db, amount: number): number {
  if (!Number.isInteger(amount)) {
    throw new Error(`incrementXpBalance requiere un monto entero en unidades, recibido: ${amount}`);
  }

  const existing = db.prepare('SELECT value FROM meta WHERE key = ?').get('xp_balance');
  if (!existing) {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('xp_balance', '0');
  }

  const res = db.prepare(
    `UPDATE meta
     SET value = CAST(CAST(value AS INTEGER) + CAST(? AS INTEGER) AS TEXT)
     WHERE key = 'xp_balance' AND (CAST(value AS INTEGER) + CAST(? AS INTEGER)) >= 0`
  ).run(amount, amount);

  if (res.changes === 0) {
    const current = getXpBalance(db);
    throw new Error(`Saldo de XP insuficiente: se intento debitar ${Math.abs(amount)} con saldo disponible de ${current}`);
  }

  return getXpBalance(db);
}

export function getDeepseekKey(db: Db): string | null {
  return getMeta(db, 'deepseek_api_key');
}

export function setDeepseekKey(db: Db, key: string): void {
  setMeta(db, 'deepseek_api_key', key);
}

/**
 * Calibración del sonido de apertura. Eran constantes en el código, y ajustar un sample
 * nuevo obligaba a editar dos archivos: el offset es dónde arranca la parte útil de la
 * grabación, y la duración es cuánto tiene que girar el carrete para frenar cuando el
 * audio revela el arma.
 */
export interface OpeningSound {
  offsetSeconds: number;
  spinDurationMs: number;
}

export const OPENING_SOUND_DEFAULT: OpeningSound = { offsetSeconds: 5, spinDurationMs: 6500 };

const OFFSET_MAX_S = 120;
const SPIN_MIN_MS = 500;
const SPIN_MAX_MS = 30000;

export function getOpeningSound(db: Db): OpeningSound {
  // `Number(null)` es 0, no NaN: sin este paso, una clave ausente pasaba como offset cero
  // válido y el sample arrancaba desde el principio del archivo en vez del default.
  const rawOffset = getMeta(db, 'opening_sound_offset_s');
  const rawSpin = getMeta(db, 'opening_spin_duration_ms');
  const offset = rawOffset === null ? NaN : Number(rawOffset);
  const spin = rawSpin === null ? NaN : Number(rawSpin);

  // Un valor guardado fuera de rango (base editada a mano, migración a medias) no puede
  // dejar el carrete sin girar: se cae al default en vez de propagar el disparate.
  return {
    offsetSeconds: isValidOffset(offset) ? offset : OPENING_SOUND_DEFAULT.offsetSeconds,
    spinDurationMs: isValidSpin(spin) ? spin : OPENING_SOUND_DEFAULT.spinDurationMs,
  };
}

export function setOpeningSound(db: Db, input: OpeningSound): void {
  if (!isValidOffset(input.offsetSeconds)) throw new Error('offset invalido');
  if (!isValidSpin(input.spinDurationMs)) throw new Error('duracion invalida');

  setMeta(db, 'opening_sound_offset_s', String(input.offsetSeconds));
  setMeta(db, 'opening_spin_duration_ms', String(Math.round(input.spinDurationMs)));
}

function isValidOffset(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= OFFSET_MAX_S;
}

function isValidSpin(value: number): boolean {
  return Number.isFinite(value) && value >= SPIN_MIN_MS && value <= SPIN_MAX_MS;
}

/**
 * Economía de la reventa. Los dos números existen porque, sin ellos, poder vender rompe
 * el juego: la Clutch Case cuesta 1 XP y contiene cuchillos, y con 1,5% de probabilidad
 * sobre objetos de cientos de dólares el valor esperado de abrirla supera de largo lo que
 * cuesta. Abrir en bucle imprimiría XP y las tareas dejarían de ser la fuente.
 *
 * `keyCostXp` es el mismo freno que usa CS2 real: la caja es barata, la llave no, y el
 * costo por apertura no baja de ahí. `sellRate` es el recorte sobre el valor de mercado.
 *
 * Los defaults son estimaciones, no medidas: calcular el valor esperado real exigiría
 * cotizar las 11.392 skins del catálogo. Por eso son perillas y no constantes.
 */
export interface SaleEconomy {
  sellRate: number;
  /** En unidades de XP (centésimas), como todo monto guardado. Ver lib/xp.ts. */
  keyCostXpUnits: number;
}

export const SALE_ECONOMY_DEFAULT: SaleEconomy = { sellRate: 0.4, keyCostXpUnits: toXpUnits(8) };

export function getSaleEconomy(db: Db): SaleEconomy {
  const rawRate = getMeta(db, 'sell_rate');
  const rawKey = getMeta(db, 'key_cost_xp');
  const rate = rawRate === null ? NaN : Number(rawRate);
  const key = rawKey === null ? NaN : Number(rawKey);

  return {
    sellRate: isValidRate(rate) ? rate : SALE_ECONOMY_DEFAULT.sellRate,
    keyCostXpUnits: isValidKey(key) ? key : SALE_ECONOMY_DEFAULT.keyCostXpUnits,
  };
}

export function setSaleEconomy(db: Db, input: SaleEconomy): void {
  if (!isValidRate(input.sellRate)) throw new Error('tasa de venta invalida');
  if (!isValidKey(input.keyCostXpUnits)) throw new Error('costo de llave invalido');

  setMeta(db, 'sell_rate', String(input.sellRate));
  setMeta(db, 'key_cost_xp', String(Math.round(input.keyCostXpUnits)));
}

// Tope en 1: pagar mas del valor de mercado seria una impresora aun mas directa.
function isValidRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

// Tope en 10.000 XP expresado en unidades: el numero cambio de escala, el limite no.
function isValidKey(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= toXpUnits(10000);
}
