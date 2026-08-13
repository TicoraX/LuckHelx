import { randomUUID } from 'crypto';
import type { Db } from './db';
import { getXpBalance, incrementXpBalance } from './settings-store';

export interface RewardRow {
  id: string;
  type: 'shop' | 'chest' | 'chest_item';
  name: string;
  xp_cost: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | string | null;
  image: string | null;
  rarity_color: string | null;
  created_at: string;
}

export function listRewards(db: Db): RewardRow[] {
  return db.prepare('SELECT * FROM rewards ORDER BY created_at ASC, rowid ASC').all() as RewardRow[];
}

export function insertReward(
  db: Db,
  input: {
    type: RewardRow['type'];
    name: string;
    xpCost: number;
    rarity: RewardRow['rarity'];
    image?: string | null;
    rarityColor?: string | null;
  }
): RewardRow {
  if (!Number.isFinite(input.xpCost) || !Number.isInteger(input.xpCost) || input.xpCost <= 0) {
    throw new Error('costo invalido');
  }

  const id = randomUUID();
  db.prepare(
    'INSERT INTO rewards (id, type, name, xp_cost, rarity, image, rarity_color) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.type, input.name, input.xpCost, input.rarity, input.image ?? null, input.rarityColor ?? null);
  return getRewardById(db, id)!;
}

export function getRewardById(db: Db, id: string): RewardRow | null {
  const row = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id) as RewardRow | undefined;
  return row ?? null;
}

// Type is deliberately not editable — changing 'chest' <-> 'chest_item' after the
// fact could silently invalidate an existing chest's prize pool.
export function updateReward(
  db: Db,
  id: string,
  input: { name: string; xpCost: number; rarity: RewardRow['rarity'] }
): RewardRow {
  const existing = getRewardById(db, id);
  if (!existing) throw new Error('recompensa no encontrada');

  db.prepare('UPDATE rewards SET name = ?, xp_cost = ?, rarity = ? WHERE id = ?').run(
    input.name,
    input.xpCost,
    existing.type === 'chest_item' ? input.rarity : null,
    id
  );
  return getRewardById(db, id)!;
}

// Redemption history references rewards by id (see the `redemptions` FK) — deleting
// a reward that's already been redeemed would either violate that FK (with foreign
// keys enforcement on) or silently orphan a ledger entry (without it). Neither is
// acceptable for a ledger app, so this is a hard, explicit rule rather than relying
// on the FK's own error message.
export function deleteReward(db: Db, id: string): void {
  const existing = getRewardById(db, id);
  if (!existing) throw new Error('recompensa no encontrada');

  const redemptionCount = db
    .prepare('SELECT COUNT(*) as count FROM redemptions WHERE reward_id = ?')
    .get(id) as { count: number };
  if (redemptionCount.count > 0) {
    throw new Error('no se puede borrar una recompensa que ya fue canjeada');
  }

  // chest_contents referencia rewards(id) por las dos columnas: un cofre arrastra sus
  // propios links, y un premio puede estar listado en cofres que siguen existiendo.
  db.prepare('DELETE FROM chest_contents WHERE chest_id = ? OR chest_item_id = ?').run(id, id);
  db.prepare('DELETE FROM rewards WHERE id = ?').run(id);
}

export function addChestContents(db: Db, chestId: string, chestItemId: string): void {
  db.prepare(
    'INSERT OR IGNORE INTO chest_contents (chest_id, chest_item_id) VALUES (?, ?)'
  ).run(chestId, chestItemId);
}

export function getChestPool(db: Db, chestId: string): RewardRow[] {
  return db
    .prepare(
      `SELECT rewards.* FROM rewards
       JOIN chest_contents ON chest_contents.chest_item_id = rewards.id
       WHERE chest_contents.chest_id = ?`
    )
    .all(chestId) as RewardRow[];
}

export function listChestContents(db: Db): { chestId: string; chestItemId: string }[] {
  return (
    db.prepare('SELECT chest_id as chestId, chest_item_id as chestItemId FROM chest_contents').all() as {
      chestId: string;
      chestItemId: string;
    }[]
  );
}

export function countRedemptions(db: Db): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM redemptions').get() as { count: number };
  return row.count;
}

export interface RedemptionRow {
  id: string;
  reward_id: string;
  reward_name: string;
  xp_spent: number;
  redeemed_at: string;
  won_item_id: string | null;
  won_item_name: string | null;
  won_item_rarity: string | null;
  won_item_image: string | null;
}

// Sin JOIN a rewards: el nombre sale de la copia que se guardó al canjear, así que
// renombrar o borrar la recompensa hoy no reescribe el movimiento de hace tres meses.
export function listRedemptions(db: Db): RedemptionRow[] {
  return db
    .prepare(
      `SELECT id, reward_id, reward_name_snapshot as reward_name, xp_spent, redeemed_at,
              won_item_id, won_item_name, won_item_rarity, won_item_image
       FROM redemptions
       ORDER BY redeemed_at DESC, rowid DESC`
    )
    .all() as RedemptionRow[];
}

export interface InventoryRow {
  id: string;
  name: string;
  rarity: string | null;
  image: string | null;
  count: number;
  first_at: string;
  last_at: string;
}

/**
 * El inventario no es una tabla: es lo que dicen los canjes. Cada apertura ya guarda el
 * objeto que salió, así que agrupar por él da lo que el usuario tiene, sin duplicar el
 * dato en otro lado donde pueda desincronizarse.
 *
 * Los canjes previos a la migración del snapshot quedan afuera: de esos no se guardó
 * nunca qué salió y no hay de dónde recuperarlo.
 */
export function listInventory(db: Db): InventoryRow[] {
  // Lo que tenés es lo que ganaste menos lo que vendiste. Vender no borra el canje: el
  // movimiento de XP de aquel día sigue en el ledger, y la venta se suma como hecho nuevo.
  return db
    .prepare(
      `SELECT r.won_item_id as id,
              r.won_item_name as name,
              r.won_item_rarity as rarity,
              r.won_item_image as image,
              COUNT(*) - (SELECT COUNT(*) FROM item_sales s WHERE s.item_id = r.won_item_id) as count,
              MIN(r.redeemed_at) as first_at,
              MAX(r.redeemed_at) as last_at
       FROM redemptions r
       WHERE r.won_item_id IS NOT NULL
       GROUP BY r.won_item_id
       HAVING count > 0
       ORDER BY count DESC, last_at DESC`
    )
    .all() as InventoryRow[];
}

export interface SaleRow {
  id: string;
  item_id: string;
  item_name: string;
  item_rarity: string | null;
  item_image: string | null;
  unit_usd: number | null;
  xp_credited: number;
  sold_at: string;
}

export function listSales(db: Db): SaleRow[] {
  return db.prepare('SELECT * FROM item_sales ORDER BY sold_at DESC, rowid DESC').all() as SaleRow[];
}

/**
 * Vende una unidad y acredita el XP. Devuelve null si ya no queda ninguna, que es lo que
 * pasa cuando llegan dos clicks seguidos: el chequeo de stock y la inserción van en la
 * misma transacción justamente para que el segundo no cobre por algo que ya no existe.
 */
export function sellOneItem(
  db: Db,
  itemId: string,
  xpCredited: number,
  unitUsd: number | null
): SaleRow | null {
  let sale: SaleRow | null = null;

  const tx = db.transaction(() => {
    const owned = listInventory(db).find((row) => row.id === itemId);
    if (!owned) return;

    const id = randomUUID();
    db.prepare(
      `INSERT INTO item_sales (id, item_id, item_name, item_rarity, item_image, unit_usd, xp_credited)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, itemId, owned.name, owned.rarity, owned.image, unitUsd, xpCredited);

    incrementXpBalance(db, xpCredited);
    sale = db.prepare('SELECT * FROM item_sales WHERE id = ?').get(id) as SaleRow;
  });
  tx();

  return sale;
}

export interface WonItem {
  id: string;
  name: string;
  rarity: string;
  image?: string | null;
}

/**
 * `extraXp` es el costo de la llave en las aperturas de cofre. Se cobra y se registra
 * junto al precio de la caja: el ledger tiene que decir lo que salió del bolsillo, no solo
 * lo que figuraba en la etiqueta.
 */
export function redeemIfSufficient(
  db: Db,
  rewardId: string,
  wonItem?: WonItem,
  extraXp = 0
): RewardRow | null {
  const reward = getRewardById(db, rewardId);
  if (!reward) throw new Error('recompensa no encontrada');

  const total = reward.xp_cost + extraXp;

  let redeemed: RewardRow | null = null;
  const tx = db.transaction(() => {
    if (getXpBalance(db) < total) return;
    incrementXpBalance(db, -total);
    db.prepare(
      `INSERT INTO redemptions
         (id, reward_id, xp_spent, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity, won_item_image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      reward.id,
      total,
      reward.name,
      wonItem?.id ?? null,
      wonItem?.name ?? null,
      wonItem?.rarity ?? null,
      wonItem?.image ?? null
    );
    redeemed = reward;
  });
  tx();

  return redeemed;
}
