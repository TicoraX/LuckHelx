import { randomUUID } from 'crypto';
import type { Db } from './db';
import { listInventory, getRewardById, type RewardRow } from './rewards-store';

export const VALID_TRADE_UP_RARITIES = ['common', 'rare', 'epic'] as const;
export type TradeUpInputRarity = (typeof VALID_TRADE_UP_RARITIES)[number];

export const RARITY_UPGRADES: Record<TradeUpInputRarity, 'rare' | 'epic' | 'legendary'> = {
  common: 'rare',
  rare: 'epic',
  epic: 'legendary',
};

export interface TradeUpResult {
  tradeUpId: string;
  targetRarity: 'rare' | 'epic' | 'legendary';
  wonItem: RewardRow;
}

export function executeTradeUp(
  db: Db,
  input: {
    inputRarity: TradeUpInputRarity;
    itemIds: string[];
    operationId?: string;
  }
): TradeUpResult {
  if (input.operationId) {
    const existing = db
      .prepare('SELECT id, target_rarity, result_reward_id FROM trade_ups WHERE id = ?')
      .get(input.operationId) as { id: string; target_rarity: 'rare' | 'epic' | 'legendary'; result_reward_id: string } | undefined;
    if (existing) {
      const wonItem = getRewardById(db, existing.result_reward_id);
      if (wonItem) {
        return {
          tradeUpId: existing.id,
          targetRarity: existing.target_rarity,
          wonItem,
        };
      }
    }
  }
  if (!VALID_TRADE_UP_RARITIES.includes(input.inputRarity)) {
    throw new Error(`rareza de entrada invalida: ${input.inputRarity}`);
  }

  if (!Array.isArray(input.itemIds) || input.itemIds.length !== 10) {
    throw new Error('un contrato de intercambio requiere exactamente 10 skins');
  }

  const targetRarity = RARITY_UPGRADES[input.inputRarity];

  const requestedCounts: Record<string, number> = {};
  for (const id of input.itemIds) {
    if (typeof id !== 'string' || !id) throw new Error('id de objeto invalido');
    requestedCounts[id] = (requestedCounts[id] ?? 0) + 1;
  }

  const inventory = listInventory(db);
  const inventoryMap = new Map(inventory.map((item) => [item.id, item]));

  for (const [id, count] of Object.entries(requestedCounts)) {
    const owned = inventoryMap.get(id);
    if (!owned) {
      throw new Error(`no tienes el objeto ${id} en tu inventario`);
    }
    if (owned.rarity !== input.inputRarity) {
      throw new Error(`todos los objetos deben ser de rareza ${input.inputRarity}`);
    }
    if (owned.count < count) {
      throw new Error(`no tienes suficientes copias de ${owned.name} (tienes ${owned.count}, requieres ${count})`);
    }
  }

  const targetCandidates = db
    .prepare("SELECT * FROM rewards WHERE type = 'chest_item' AND rarity = ? ORDER BY RANDOM() LIMIT 1")
    .all(targetRarity) as RewardRow[];

  if (targetCandidates.length === 0) {
    throw new Error(`no hay skins disponibles de rareza ${targetRarity}`);
  }

  const wonItem = targetCandidates[0];
  const tradeUpId = input.operationId || randomUUID();
  const redemptionId = randomUUID();
  const now = new Date().toISOString();

  db.transaction(() => {
    // 1. Burn 10 items via item_sales
    for (const [id, count] of Object.entries(requestedCounts)) {
      const owned = inventoryMap.get(id)!;
      for (let i = 0; i < count; i++) {
        db.prepare(
          `INSERT INTO item_sales (id, item_id, item_name, item_rarity, item_image, unit_usd, xp_credited, sold_at)
           VALUES (?, ?, ?, ?, ?, 0, 0, ?)`
        ).run(randomUUID(), id, `[Trade-Up] ${owned.name}`, owned.rarity, owned.image, now);
      }
    }

    // 2. Add upgraded item to redemptions
    db.prepare(
      `INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity, won_item_image)
       VALUES (?, ?, 0, ?, 'Contrato Trade-Up', ?, ?, ?, ?)`
    ).run(
      redemptionId,
      wonItem.id,
      now,
      wonItem.id,
      wonItem.name,
      wonItem.rarity,
      wonItem.image
    );

    // 3. Record in trade_ups table
    db.prepare(
      'INSERT INTO trade_ups (id, target_rarity, result_reward_id, created_at) VALUES (?, ?, ?, ?)'
    ).run(tradeUpId, targetRarity, wonItem.id, now);
  })();

  return {
    tradeUpId,
    targetRarity,
    wonItem,
  };
}
