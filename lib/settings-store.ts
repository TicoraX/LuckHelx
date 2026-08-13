import type { Db } from './db';

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
  const next = getXpBalance(db) + amount;
  setMeta(db, 'xp_balance', String(next));
  return next;
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
