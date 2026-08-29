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
});
