import { randomUUID } from 'crypto';
import type { Db } from './db';
import { getXpBalance, incrementXpBalance } from './settings-store';

export interface RewardRow {
  id: string;
  type: 'shop' | 'chest' | 'chest_item';
  name: string;
  xp_cost: number;
  rarity: 'common' | 'rare' | 'epic' | string | null;
  image?: string | null;
  rarity_color?: string | null;
  created_at: string;
}

export function listRewards(db: Db): RewardRow[] {
  return db.prepare('SELECT * FROM rewards ORDER BY created_at ASC, rowid ASC').all() as RewardRow[];
}

export function insertReward(
  db: Db,
  input: { type: RewardRow['type']; name: string; xpCost: number; rarity: RewardRow['rarity'] }
): RewardRow {
  if (!Number.isFinite(input.xpCost) || !Number.isInteger(input.xpCost) || input.xpCost <= 0) {
    throw new Error('costo invalido');
  }

  const id = randomUUID();
  db.prepare('INSERT INTO rewards (id, type, name, xp_cost, rarity) VALUES (?, ?, ?, ?, ?)').run(
    id,
    input.type,
    input.name,
    input.xpCost,
    input.rarity
  );
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

  db.prepare('DELETE FROM rewards WHERE id = ?').run(id);
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
}

export function listRedemptions(db: Db): RedemptionRow[] {
  return db
    .prepare(
      `SELECT redemptions.id, redemptions.reward_id, rewards.name as reward_name, redemptions.xp_spent, redemptions.redeemed_at
       FROM redemptions JOIN rewards ON rewards.id = redemptions.reward_id
       ORDER BY redemptions.redeemed_at DESC, redemptions.rowid DESC`
    )
    .all() as RedemptionRow[];
}

export function redeemIfSufficient(db: Db, rewardId: string): RewardRow | null {
  const reward = getRewardById(db, rewardId);
  if (!reward) throw new Error('recompensa no encontrada');

  let redeemed: RewardRow | null = null;
  const tx = db.transaction(() => {
    if (getXpBalance(db) < reward.xp_cost) return;
    incrementXpBalance(db, -reward.xp_cost);
    db.prepare('INSERT INTO redemptions (id, reward_id, xp_spent) VALUES (?, ?, ?)').run(
      randomUUID(),
      reward.id,
      reward.xp_cost
    );
    redeemed = reward;
  });
  tx();

  return redeemed;
}
