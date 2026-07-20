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
