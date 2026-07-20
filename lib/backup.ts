import type { Db } from './db';

export interface BackupData {
  version: 1;
  exportedAt: string;
  meta: { key: string; value: string }[];
  tasks: Record<string, unknown>[];
  rewards: Record<string, unknown>[];
  redemptions: Record<string, unknown>[];
}

export function exportBackup(db: Db): BackupData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    meta: db.prepare('SELECT * FROM meta').all() as { key: string; value: string }[],
    tasks: db.prepare('SELECT * FROM tasks').all() as Record<string, unknown>[],
    rewards: db.prepare('SELECT * FROM rewards').all() as Record<string, unknown>[],
    redemptions: db.prepare('SELECT * FROM redemptions').all() as Record<string, unknown>[],
  };
}

function isPlainObjectArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'object' && v !== null && !Array.isArray(v));
}

// Only accepts the exact shape exportBackup produces — this is a full-replace
// restore for a single-user local app, not a general-purpose import format.
export function isValidBackup(value: unknown): value is BackupData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.exportedAt === 'string' &&
    isPlainObjectArray(v.meta) &&
    isPlainObjectArray(v.tasks) &&
    isPlainObjectArray(v.rewards) &&
    isPlainObjectArray(v.redemptions)
  );
}

function insertRow(db: Db, table: string, row: Record<string, unknown>): void {
  const columns = Object.keys(row);
  const placeholders = columns.map(() => '?').join(', ');
  db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...columns.map((c) => row[c]));
}

// Wipes every table and reinserts the backup's rows, all inside one transaction —
// either the whole restore lands, or (on any bad row) none of it does.
export function restoreBackup(db: Db, backup: BackupData): void {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM redemptions').run();
    db.prepare('DELETE FROM rewards').run();
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM meta').run();

    for (const row of backup.meta) insertRow(db, 'meta', row as unknown as Record<string, unknown>);
    for (const row of backup.tasks) insertRow(db, 'tasks', row);
    for (const row of backup.rewards) insertRow(db, 'rewards', row);
    for (const row of backup.redemptions) insertRow(db, 'redemptions', row);
  });
  tx();
}
