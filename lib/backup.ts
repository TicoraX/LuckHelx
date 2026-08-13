import type { Db } from './db';

export interface BackupData {
  // 2 agrega item_sales y skin_prices, y las columnas de snapshot de redemptions. Los
  // respaldos version 1 se siguen restaurando: lo que no traen queda vacío.
  version: 1 | 2;
  exportedAt: string;
  meta: { key: string; value: string }[];
  tasks: Record<string, unknown>[];
  rewards: Record<string, unknown>[];
  // Opcional: los backups exportados antes de las cajas de CS2 no traen esta tabla.
  chestContents?: Record<string, unknown>[];
  redemptions: Record<string, unknown>[];
  // Opcionales por lo mismo: no existían en los respaldos version 1.
  itemSales?: Record<string, unknown>[];
  skinPrices?: Record<string, unknown>[];
}

export function exportBackup(db: Db): BackupData {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    meta: db.prepare('SELECT * FROM meta').all() as { key: string; value: string }[],
    tasks: db.prepare('SELECT * FROM tasks').all() as Record<string, unknown>[],
    rewards: db.prepare('SELECT * FROM rewards').all() as Record<string, unknown>[],
    chestContents: db.prepare('SELECT * FROM chest_contents').all() as Record<string, unknown>[],
    redemptions: db.prepare('SELECT * FROM redemptions').all() as Record<string, unknown>[],
    itemSales: db.prepare('SELECT * FROM item_sales').all() as Record<string, unknown>[],
    skinPrices: db.prepare('SELECT * FROM skin_prices').all() as Record<string, unknown>[],
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
    (v.version === 1 || v.version === 2) &&
    typeof v.exportedAt === 'string' &&
    isPlainObjectArray(v.meta) &&
    isPlainObjectArray(v.tasks) &&
    isPlainObjectArray(v.rewards) &&
    (v.chestContents === undefined || isPlainObjectArray(v.chestContents)) &&
    isPlainObjectArray(v.redemptions) &&
    (v.itemSales === undefined || isPlainObjectArray(v.itemSales)) &&
    (v.skinPrices === undefined || isPlainObjectArray(v.skinPrices))
  );
}

function insertRow(db: Db, table: string, row: Record<string, unknown>): void {
  const columnsByTable: Record<string, readonly string[]> = {
    meta: ['key', 'value'],
    tasks: ['id', 'title', 'description', 'description_normalized', 'xp_value', 'xp_reasoning', 'status', 'created_at', 'completed_at'],
    rewards: ['id', 'type', 'name', 'xp_cost', 'rarity', 'image', 'rarity_color', 'created_at'],
    chest_contents: ['chest_id', 'chest_item_id'],
    redemptions: [
      'id', 'reward_id', 'xp_spent', 'redeemed_at',
      // El historial guarda copia del nombre y del objeto ganado. Sin estas columnas acá,
      // restaurar un respaldo devolvía cada canje de cofre sin el arma que salió.
      'reward_name_snapshot', 'won_item_id', 'won_item_name', 'won_item_rarity', 'won_item_image',
    ],
    item_sales: ['id', 'item_id', 'item_name', 'item_rarity', 'item_image', 'unit_usd', 'xp_credited', 'sold_at'],
    skin_prices: ['name', 'usd', 'wear', 'fetched_at'],
  };
  const allowedColumns = columnsByTable[table];
  if (!allowedColumns) {
    throw new Error(`tabla desconocida: ${table}`);
  }

  const columns = allowedColumns.filter((column) => Object.prototype.hasOwnProperty.call(row, column));
  const placeholders = columns.map(() => '?').join(', ');
  db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...columns.map((c) => row[c]));
}

// Wipes every table and reinserts the backup's rows, all inside one transaction —
// either the whole restore lands, or (on any bad row) none of it does.
export function restoreBackup(db: Db, backup: BackupData): void {
  const tx = db.transaction(() => {
    // chest_contents y redemptions referencian rewards(id): con foreign_keys = ON
    // hay que borrarlas antes que rewards, e insertarlas después.
    // item_sales y skin_prices no referencian rewards (a propósito: el pasado no se
    // reescribe), pero se vacían igual porque esto es un reemplazo total, no una fusión.
    db.prepare('DELETE FROM item_sales').run();
    db.prepare('DELETE FROM skin_prices').run();
    db.prepare('DELETE FROM redemptions').run();
    db.prepare('DELETE FROM chest_contents').run();
    db.prepare('DELETE FROM rewards').run();
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM meta').run();

    for (const row of backup.meta) insertRow(db, 'meta', row as unknown as Record<string, unknown>);
    for (const row of backup.tasks) insertRow(db, 'tasks', row);
    for (const row of backup.rewards) insertRow(db, 'rewards', row);
    for (const row of backup.chestContents ?? []) insertRow(db, 'chest_contents', row);
    for (const row of backup.redemptions) insertRow(db, 'redemptions', row);
    for (const row of backup.itemSales ?? []) insertRow(db, 'item_sales', row);
    for (const row of backup.skinPrices ?? []) insertRow(db, 'skin_prices', row);
  });
  tx();
}
