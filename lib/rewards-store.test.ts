import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { getXpBalance, incrementXpBalance } from './settings-store';
import { listRewards, insertReward, getRewardById, countRedemptions, redeemIfSufficient, updateReward, deleteReward, listRedemptions } from './rewards-store';

describe('rewards-store', () => {
  it('inserts and lists rewards, oldest first', () => {
    const db = createTestDb();
    insertReward(db, { type: 'shop', name: 'a', xpCost: 10, rarity: null });
    insertReward(db, { type: 'shop', name: 'b', xpCost: 20, rarity: null });
    expect(listRewards(db).map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('breaks ties in oldest-first order with rowid ascending', () => {
    const db = createTestDb();
    db.prepare(
      `INSERT INTO rewards (id, type, name, xp_cost, rarity, created_at)
       VALUES ('r1', 'shop', 'a', 10, NULL, '2026-07-19T00:00:00.000Z')`
    ).run();
    db.prepare(
      `INSERT INTO rewards (id, type, name, xp_cost, rarity, created_at)
       VALUES ('r2', 'shop', 'b', 20, NULL, '2026-07-19T00:00:00.000Z')`
    ).run();

    expect(listRewards(db).map((r) => r.id)).toEqual(['r1', 'r2']);
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

  it('updates name/cost/rarity but ignores rarity for non-chest_item types', () => {
    const db = createTestDb();
    const reward = insertReward(db, { type: 'shop', name: 'a', xpCost: 10, rarity: null });
    const updated = updateReward(db, reward.id, { name: 'b', xpCost: 25, rarity: 'epic' });
    expect(updated).toMatchObject({ name: 'b', xp_cost: 25, rarity: null });
  });

  it('updates rarity for chest_item rewards', () => {
    const db = createTestDb();
    const reward = insertReward(db, { type: 'chest_item', name: 'sword', xpCost: 5, rarity: 'common' });
    const updated = updateReward(db, reward.id, { name: 'sword', xpCost: 5, rarity: 'epic' });
    expect(updated.rarity).toBe('epic');
  });

  it('throws when updating a reward that does not exist', () => {
    const db = createTestDb();
    expect(() => updateReward(db, 'nope', { name: 'x', xpCost: 1, rarity: null })).toThrow(/no encontrada/);
  });

  it('rejects insertReward with a non-integer cost', () => {
    const db = createTestDb();
    expect(() => insertReward(db, { type: 'shop', name: 'a', xpCost: 1.5, rarity: null })).toThrow(/costo invalido/);
  });

  it('deletes a reward with no redemption history', () => {
    const db = createTestDb();
    const reward = insertReward(db, { type: 'shop', name: 'a', xpCost: 10, rarity: null });
    deleteReward(db, reward.id);
    expect(getRewardById(db, reward.id)).toBeNull();
  });

  it('refuses to delete a reward that has been redeemed', () => {
    const db = createTestDb();
    incrementXpBalance(db, 10);
    const reward = insertReward(db, { type: 'shop', name: 'a', xpCost: 10, rarity: null });
    redeemIfSufficient(db, reward.id);
    expect(() => deleteReward(db, reward.id)).toThrow(/ya fue canjeada/);
    expect(getRewardById(db, reward.id)).not.toBeNull();
  });

  it('throws when deleting a reward that does not exist', () => {
    const db = createTestDb();
    expect(() => deleteReward(db, 'nope')).toThrow(/no encontrada/);
  });

  it('lists redemptions joined with the reward name, newest first', () => {
    const db = createTestDb();
    incrementXpBalance(db, 100);
    const coffee = insertReward(db, { type: 'shop', name: 'coffee', xpCost: 10, rarity: null });
    const nap = insertReward(db, { type: 'shop', name: 'nap', xpCost: 20, rarity: null });
    redeemIfSufficient(db, coffee.id);
    redeemIfSufficient(db, nap.id);

    const rows = listRedemptions(db);
    expect(rows.map((r) => r.reward_name)).toEqual(['nap', 'coffee']);
    expect(rows[0].xp_spent).toBe(20);
  });
});
