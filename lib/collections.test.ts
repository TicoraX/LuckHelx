import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { insertReward, addChestContents } from './rewards-store';
import { getChestCollections } from './collections';

describe('Chest Collections Album Engine', () => {
  it('computes collection progress per chest correctly', () => {
    const db = createTestDb();
    const chest = insertReward(db, { type: 'chest', name: 'Kilowatt Case', xpCost: 500, rarity: null });
    const item1 = insertReward(db, { type: 'chest_item', name: 'Zeus x27', xpCost: 100, rarity: 'common' });
    const item2 = insertReward(db, { type: 'chest_item', name: 'AWP Chrome', xpCost: 200, rarity: 'rare' });

    addChestContents(db, chest.id, item1.id);
    addChestContents(db, chest.id, item2.id);

    const collections = getChestCollections(db);
    expect(collections.length).toBe(1);
    expect(collections[0].totalItems).toBe(2);
    expect(collections[0].collectedItems).toBe(0);
    expect(collections[0].percentComplete).toBe(0);
  });

  it('keeps skins unlocked in collection album even after item is sold', () => {
    const db = createTestDb();
    const chest = insertReward(db, { type: 'chest', name: 'Kilowatt Case', xpCost: 500, rarity: null });
    const item1 = insertReward(db, { type: 'chest_item', name: 'Zeus x27', xpCost: 100, rarity: 'common' });
    addChestContents(db, chest.id, item1.id);

    // Redeem item
    db.prepare(
      `INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity)
       VALUES ('red-1', ?, 500, datetime('now'), 'Kilowatt Case', ?, 'Zeus x27', 'common')`
    ).run(chest.id, item1.id);

    expect(getChestCollections(db)[0].collectedItems).toBe(1);

    // Sell item via item_sales
    db.prepare(
      `INSERT INTO item_sales (id, item_id, item_name, item_rarity, unit_usd, xp_credited, sold_at)
       VALUES ('sale-1', ?, 'Zeus x27', 'common', 1.0, 100, datetime('now'))`
    ).run(item1.id);

    // Collection album must still show 1 collected item!
    expect(getChestCollections(db)[0].collectedItems).toBe(1);
    expect(getChestCollections(db)[0].isCompleted).toBe(true);
  });
});
