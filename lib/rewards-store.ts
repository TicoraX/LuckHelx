import { randomUUID } from 'crypto';
import type { Db } from './db';
import { getXpBalance, incrementXpBalance } from './settings-store';

export interface RewardRow {
  id: string;
  type: 'shop' | 'chest' | 'chest_item';
  name: string;
  xp_cost: number;
  rarity: 'common' | 'rare' | 'epic' | null;
  created_at: string;
}

export function listRewards(db: Db): RewardRow[] {
  return db.prepare('SELECT * FROM rewards ORDER BY created_at ASC, rowid ASC').all() as RewardRow[];
}

export function insertReward(
  db: Db,
  input: { type: RewardRow['type']; name: string; xpCost: number; rarity: RewardRow['rarity'] }
): RewardRow {
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

export function countRedemptions(db: Db): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM redemptions').get() as { count: number };
  return row.count;
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
