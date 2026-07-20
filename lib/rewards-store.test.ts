import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { getXpBalance, incrementXpBalance } from './settings-store';
import { listRewards, insertReward, getRewardById, countRedemptions, redeemIfSufficient } from './rewards-store';

describe('rewards-store', () => {
  it('inserts and lists rewards, oldest first', () => {
    const db = createTestDb();
    insertReward(db, { type: 'shop', name: 'a', xpCost: 10, rarity: null });
    insertReward(db, { type: 'shop', name: 'b', xpCost: 20, rarity: null });
    expect(listRewards(db).map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('redeems successfully when balance is sufficient, deducting exactly the cost', () => {
    const db = createTestDb();
    incrementXpBalance(db, 50);
    const reward = insertReward(db, { type: 'shop', name: 'coffee', xpCost: 30, rarity: null });

    const redeemed = redeemIfSufficient(db, reward.id);

    expect(redeemed?.name).toBe('coffee');
    expect(getXpBalance(db)).toBe(20);
    expect(countRedemptions(db)).toBe(1);
  });

  it('rejects redeeming twice when the balance only covers it once', () => {
    const db = createTestDb();
    incrementXpBalance(db, 30);
    const reward = insertReward(db, { type: 'shop', name: 'coffee', xpCost: 30, rarity: null });

    expect(redeemIfSufficient(db, reward.id)).not.toBeNull();
    expect(redeemIfSufficient(db, reward.id)).toBeNull(); // balance is now 0, second call must fail
    expect(getXpBalance(db)).toBe(0); // unchanged by the rejected second call
    expect(countRedemptions(db)).toBe(1);
  });

  it('throws when redeeming a reward that does not exist', () => {
    const db = createTestDb();
    expect(() => redeemIfSufficient(db, 'nope')).toThrow(/no encontrada/);
  });

  it('getRewardById returns null for a missing id', () => {
    const db = createTestDb();
    expect(getRewardById(db, 'nope')).toBeNull();
  });
});
