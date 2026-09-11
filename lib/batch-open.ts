import { randomUUID } from 'crypto';
import type { Db } from './db';
import { getRewardById, getChestPool } from './rewards-store';
import { getXpBalance, getSaleEconomy, incrementXpBalance } from './settings-store';
import { pickChestItem } from './rewards';

export interface BatchWonItem {
  id: string;
  name: string;
  rarity: string | null;
  image: string | null;
  rarityColor: string | null;
}

export interface BatchOpenResult {
  chestName: string;
  items: BatchWonItem[];
  totalXpSpent: number;
}

export function executeBatchOpen(
  db: Db,
  input: { chestId: string; count: number; operationId?: string }
): BatchOpenResult {
  if (input.operationId) {
    const existingRow = db
      .prepare('SELECT value FROM meta WHERE key = ?')
      .get(`batch_op:${input.operationId}`) as { value: string } | undefined;
    if (existingRow) {
      try {
        return JSON.parse(existingRow.value) as BatchOpenResult;
      } catch {
        throw new Error('error al deserializar resultado de apertura previa');
      }
    }
  }

  const count = Number(input.count);
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw new Error('cantidad de apertura invalida (debe ser entre 1 y 10)');
  }

  const chest = getRewardById(db, input.chestId);
  if (!chest || chest.type !== 'chest') {
    throw new Error('cofre no encontrado');
  }

  const pool = getChestPool(db, chest.id);
  if (pool.length === 0) {
    throw new Error('no hay objetos definidos para este cofre');
  }

  const keyCost = getSaleEconomy(db).keyCostXpUnits;
  const costPerUnit = chest.xp_cost + keyCost;
  const totalCost = costPerUnit * count;

  const currentBalance = getXpBalance(db);
  if (currentBalance < totalCost) {
    throw new Error(`XP insuficiente: requieres ${totalCost / 100} XP (tienes ${currentBalance / 100} XP)`);
  }

  const wonItems: BatchWonItem[] = [];
  const now = new Date().toISOString();

  db.transaction(() => {
    incrementXpBalance(db, -totalCost);

    for (let i = 0; i < count; i++) {
      const picked = pickChestItem(
        pool.map((r) => ({ id: r.id, name: r.name, rarity: r.rarity as 'common' | 'rare' | 'epic' | 'legendary' }))
      );
      const row = pool.find((r) => r.id === picked.id)!;

      const redemptionId = randomUUID();
      db.prepare(
        `INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity, won_item_image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        redemptionId,
        chest.id,
        costPerUnit,
        now,
        chest.name,
        row.id,
        row.name,
        row.rarity,
        row.image
      );

      wonItems.push({
        id: row.id,
        name: row.name,
        rarity: row.rarity,
        image: row.image,
        rarityColor: row.rarity_color,
      });
    }

    if (input.operationId) {
      const savedResult = {
        chestName: chest.name,
        items: wonItems,
        totalXpSpent: totalCost,
      };
      db.prepare(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(`batch_op:${input.operationId}`, JSON.stringify(savedResult));
    }
  })();

  return {
    chestName: chest.name,
    items: wonItems,
    totalXpSpent: totalCost,
  };
}
