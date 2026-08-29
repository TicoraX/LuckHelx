import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { insertReward, addChestContents, listRedemptions } from './rewards-store';
import { executeBatchOpen } from './batch-open';
import { getXpBalance, incrementXpBalance } from './settings-store';

describe('Batch Chest Opening Engine', () => {
  it('rejects batch open if count is not between 1 and 10 or user lacks XP', () => {
    const db = createTestDb();
    const chest = insertReward(db, {
      type: 'chest',
      name: 'Chroma Case',
      xpCost: 500,
      rarity: null,
    });
    const item1 = insertReward(db, { type: 'chest_item', name: 'AK-47', xpCost: 100, rarity: 'common' });
    addChestContents(db, chest.id, item1.id);

    expect(() => executeBatchOpen(db, { chestId: chest.id, count: 0 })).toThrow(/cantidad de apertura invalida/);
    expect(() => executeBatchOpen(db, { chestId: chest.id, count: 20 })).toThrow(/cantidad de apertura invalida/);
    expect(() => executeBatchOpen(db, { chestId: chest.id, count: 5 })).toThrow(/XP insuficiente/);
  });

  it('successfully opens 5 chests in a single atomic transaction and awards 5 items', () => {
    const db = createTestDb();
    const chest = insertReward(db, {
      type: 'chest',
      name: 'Chroma Case',
      xpCost: 500, // 5 XP
      rarity: null,
    });

    const item1 = insertReward(db, { type: 'chest_item', name: 'AK-47', xpCost: 100, rarity: 'common' });
    const item2 = insertReward(db, { type: 'chest_item', name: 'M4A4', xpCost: 200, rarity: 'rare' });
    addChestContents(db, chest.id, item1.id);
    addChestContents(db, chest.id, item2.id);

    // Give user 10,000 XP
    incrementXpBalance(db, 10000);

    const result = executeBatchOpen(db, { chestId: chest.id, count: 5 });

    expect(result.items.length).toBe(5);
    expect(result.totalXpSpent).toBeGreaterThan(0);
    expect(getXpBalance(db)).toBe(10000 - result.totalXpSpent);

    const redemptions = listRedemptions(db);
    expect(redemptions.length).toBe(5);
    expect(redemptions.every((r) => r.won_item_id !== null)).toBe(true);
  });

  it('is idempotent when operationId is provided without deducting XP again', () => {
    const db = createTestDb();
    const chest = insertReward(db, {
      type: 'chest',
      name: 'Chroma Case',
      xpCost: 500,
      rarity: null,
    });

    const item1 = insertReward(db, { type: 'chest_item', name: 'AK-47', xpCost: 100, rarity: 'common' });
    addChestContents(db, chest.id, item1.id);

    incrementXpBalance(db, 10000);

    const opId = 'batch-op-456';
    const first = executeBatchOpen(db, { chestId: chest.id, count: 2, operationId: opId });
    const balanceAfterFirst = getXpBalance(db);

    const second = executeBatchOpen(db, { chestId: chest.id, count: 2, operationId: opId });
    const balanceAfterSecond = getXpBalance(db);

    expect(balanceAfterSecond).toBe(balanceAfterFirst);
    expect(second.items.length).toBe(first.items.length);
    expect(second.totalXpSpent).toBe(first.totalXpSpent);
  });
});
