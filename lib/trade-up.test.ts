import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { createTestDb } from './db';
import { insertReward } from './rewards-store';
import { calculateTradeUpProbabilities, executeTradeUp } from './trade-up';

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

  describe('calculo de probabilidades y coleccion de CS2', () => {
    it('calcula probabilidades proporcionales exactas entre dos cajas', () => {
      const db = createTestDb();

      // Cajas
      const crateA = insertReward(db, { type: 'chest', name: 'Snakebite Case', xpCost: 100, rarity: null });
      const crateB = insertReward(db, { type: 'chest', name: 'Fracture Case', xpCost: 100, rarity: null });

      // Insumos Mil-Spec (#4b69ff)
      const inputA = insertReward(db, {
        type: 'chest_item',
        name: 'M4A4 | Insumo A',
        xpCost: 50,
        rarity: 'common',
        rarityColor: '#4b69ff',
      });
      const inputB = insertReward(db, {
        type: 'chest_item',
        name: 'Glock | Insumo B',
        xpCost: 50,
        rarity: 'common',
        rarityColor: '#4b69ff',
      });

      // Salidas Restricted (#8847ff): 2 en caja A, 1 en caja B
      const outA1 = insertReward(db, {
        type: 'chest_item',
        name: 'AK-47 | Salida A1',
        xpCost: 200,
        rarity: 'rare',
        rarityColor: '#8847ff',
      });
      const outA2 = insertReward(db, {
        type: 'chest_item',
        name: 'USP-S | Salida A2',
        xpCost: 200,
        rarity: 'rare',
        rarityColor: '#8847ff',
      });
      const outB1 = insertReward(db, {
        type: 'chest_item',
        name: 'Desert Eagle | Salida B1',
        xpCost: 200,
        rarity: 'rare',
        rarityColor: '#8847ff',
      });

      // Vincular a chest_contents
      db.prepare('INSERT INTO chest_contents (chest_id, chest_item_id) VALUES (?, ?), (?, ?), (?, ?), (?, ?), (?, ?)').run(
        crateA.id, inputA.id,
        crateA.id, outA1.id,
        crateA.id, outA2.id,
        crateB.id, inputB.id,
        crateB.id, outB1.id
      );

      // 6 de caja A y 4 de caja B
      const itemIds = [
        ...Array(6).fill(inputA.id),
        ...Array(4).fill(inputB.id),
      ];

      const preview = calculateTradeUpProbabilities(db, itemIds);

      expect(preview.inputGrade.id).toBe('milspec');
      expect(preview.targetGrade.id).toBe('restricted');
      expect(preview.collections).toHaveLength(2);

      const colA = preview.collections.find((c) => c.chestId === crateA.id);
      const colB = preview.collections.find((c) => c.chestId === crateB.id);

      expect(colA?.weightPercent).toBe(60);
      expect(colA?.outcomeCount).toBe(2);
      expect(colA?.outcomes[0].chancePercent).toBeCloseTo(30, 1);
      expect(colA?.outcomes[1].chancePercent).toBeCloseTo(30, 1);

      expect(colB?.weightPercent).toBe(40);
      expect(colB?.outcomeCount).toBe(1);
      expect(colB?.outcomes[0].chancePercent).toBeCloseTo(40, 1);

      const totalChance = preview.outcomes.reduce((sum, o) => sum + o.chancePercent, 0);
      expect(totalChance).toBeCloseTo(100, 1);
    });

    it('ejecuta trade-up y garantiza resultado de la misma caja cuando las 10 provienen de ella', () => {
      const db = createTestDb();

      const crate = insertReward(db, { type: 'chest', name: 'Kilowatt Case', xpCost: 100, rarity: null });
      const input = insertReward(db, {
        type: 'chest_item',
        name: 'Dual Berettas | Hide',
        xpCost: 20,
        rarity: 'common',
        rarityColor: '#4b69ff',
      });
      const output = insertReward(db, {
        type: 'chest_item',
        name: 'AWP | Chrome Cannon',
        xpCost: 500,
        rarity: 'rare',
        rarityColor: '#8847ff',
      });

      db.prepare('INSERT INTO chest_contents (chest_id, chest_item_id) VALUES (?, ?), (?, ?)').run(
        crate.id, input.id,
        crate.id, output.id
      );

      // El usuario es dueño de 10 copias
      for (let i = 0; i < 10; i++) {
        db.prepare(
          `INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity)
           VALUES (?, ?, 0, datetime('now'), 'Chest', ?, ?, 'common')`
        ).run(randomUUID(), crate.id, input.id, input.name);
      }

      const res = executeTradeUp(db, {
        itemIds: Array(10).fill(input.id),
      });

      expect(res.wonItem.id).toBe(output.id);
      expect(res.wonItem.name).toBe('AWP | Chrome Cannon');
    });

    it('rechaza cuando se mezclan skins de distintos grados de CS2', () => {
      const db = createTestDb();

      const milspec = insertReward(db, {
        type: 'chest_item',
        name: 'Milspec Item',
        xpCost: 50,
        rarity: 'common',
        rarityColor: '#4b69ff',
      });
      const restricted = insertReward(db, {
        type: 'chest_item',
        name: 'Restricted Item',
        xpCost: 100,
        rarity: 'rare',
        rarityColor: '#8847ff',
      });

      const itemIds = [
        ...Array(5).fill(milspec.id),
        ...Array(5).fill(restricted.id),
      ];

      expect(() => calculateTradeUpProbabilities(db, itemIds)).toThrow(
        /todas las skins deben ser del mismo grado/
      );
    });
  });
});
