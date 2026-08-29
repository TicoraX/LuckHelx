import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { insertReward } from './rewards-store';
import { executeTradeUp } from './trade-up';
import { randomUUID } from 'crypto';

describe('trade-up contracts', () => {
  it('rejects invalid input rarity or count != 10', () => {
    const db = createTestDb();
    expect(() =>
      executeTradeUp(db, {
        inputRarity: 'legendary' as any,
        itemIds: ['1', '2'],
      })
    ).toThrow(/rareza de entrada invalida/);

    expect(() =>
      executeTradeUp(db, {
        inputRarity: 'common',
        itemIds: ['1', '2'],
      })
    ).toThrow(/requiere exactamente 10 skins/);
  });

  it('successfully burns 10 common items and yields a rare item', () => {
    const db = createTestDb();

    // Insert 10 common items and 1 rare target item
    const commonItems = [];
    for (let i = 0; i < 10; i++) {
      const common = insertReward(db, {
        type: 'chest_item',
        name: `Common Skin ${i}`,
        xpCost: 100,
        rarity: 'common',
      });
      commonItems.push(common);

      // Seed them into redemptions so user owns them
      db.prepare(
        `INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity)
         VALUES (?, ?, 0, datetime('now'), 'Chest', ?, ?, 'common')`
      ).run(randomUUID(), common.id, common.id, common.name);
    }

    const rareTarget = insertReward(db, {
      type: 'chest_item',
      name: 'Rare Upgraded AK-47',
      xpCost: 500,
      rarity: 'rare',
    });

    const result = executeTradeUp(db, {
      inputRarity: 'common',
      itemIds: commonItems.map((c) => c.id),
    });

    expect(result.targetRarity).toBe('rare');
    expect(result.wonItem.id).toBe(rareTarget.id);
    expect(result.wonItem.name).toBe('Rare Upgraded AK-47');

    // Check that items are no longer available in inventory
    const remainingCommon0 = db
      .prepare(
        `SELECT COUNT(*) - (SELECT COUNT(*) FROM item_sales WHERE item_id = ?) as count
         FROM redemptions WHERE won_item_id = ?`
      )
      .get(commonItems[0].id, commonItems[0].id) as { count: number };
    expect(remainingCommon0.count).toBe(0);

    // Check that won item is in inventory
    const wonCount = db
      .prepare(
        `SELECT COUNT(*) - (SELECT COUNT(*) FROM item_sales WHERE item_id = ?) as count
         FROM redemptions WHERE won_item_id = ?`
      )
      .get(rareTarget.id, rareTarget.id) as { count: number };
    expect(wonCount.count).toBe(1);
  });
});
