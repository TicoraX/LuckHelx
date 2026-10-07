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

    // Check that ALL 10 items are no longer available in inventory
    for (const item of commonItems) {
      const remaining = db
        .prepare(
          `SELECT COUNT(*) - (SELECT COUNT(*) FROM item_sales WHERE item_id = ?) as count
           FROM redemptions WHERE won_item_id = ?`
        )
        .get(item.id, item.id) as { count: number };
      expect(remaining.count).toBe(0);
    }

    // Check that won item is in inventory
    const wonCount = db
      .prepare(
        `SELECT COUNT(*) - (SELECT COUNT(*) FROM item_sales WHERE item_id = ?) as count
         FROM redemptions WHERE won_item_id = ?`
      )
      .get(rareTarget.id, rareTarget.id) as { count: number };
    expect(wonCount.count).toBe(1);
  });

  it('is idempotent when operationId is provided', () => {
    const db = createTestDb();

    const commonItems = [];
    for (let i = 0; i < 10; i++) {
      const common = insertReward(db, {
        type: 'chest_item',
        name: `Common Skin ${i}`,
        xpCost: 100,
        rarity: 'common',
      });
      commonItems.push(common);

      db.prepare(
        `INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity)
         VALUES (?, ?, 0, datetime('now'), 'Chest', ?, ?, 'common')`
      ).run(randomUUID(), common.id, common.id, common.name);
    }

    insertReward(db, {
      type: 'chest_item',
      name: 'Rare M4A4',
      xpCost: 500,
      rarity: 'rare',
    });

    const opId = 'trade-up-op-123';
    const first = executeTradeUp(db, {
      inputRarity: 'common',
      itemIds: commonItems.map((c) => c.id),
      operationId: opId,
    });

    const second = executeTradeUp(db, {
      inputRarity: 'common',
      itemIds: commonItems.map((c) => c.id),
      operationId: opId,
    });

    expect(second.tradeUpId).toBe(first.tradeUpId);
    expect(second.wonItem.id).toBe(first.wonItem.id);
  });

  it('rejects trade-up inside transaction if user does not own all 10 items', () => {
    const db = createTestDb();
    const common = insertReward(db, {
      type: 'chest_item',
      name: 'Common Skin 1',
      xpCost: 100,
      rarity: 'common',
    });
    insertReward(db, {
      type: 'chest_item',
      name: 'Rare M4A4',
      xpCost: 500,
      rarity: 'rare',
    });
    for (let i = 0; i < 5; i++) {
      db.prepare(
        `INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity)
         VALUES (?, ?, 0, datetime('now'), 'Chest', ?, ?, 'common')`
      ).run(randomUUID(), common.id, common.id, common.name);
    }

    expect(() =>
      executeTradeUp(db, {
        inputRarity: 'common',
        itemIds: Array(10).fill(common.id),
      })
    ).toThrow(/no tienes suficientes copias/);
  });
});
