import { randomUUID } from 'crypto';
import {
  getCs2Grade,
  getNextGrade,
  isTradeUpEligible,
  TRADE_UP_INPUT_GRADES,
  type Cs2GradeId,
  type Cs2GradeInfo,
} from './cs2-grade';
import type { Db } from './db';
import { getRewardById, listInventory, type RewardRow } from './rewards-store';

export const VALID_TRADE_UP_RARITIES = ['common', 'rare', 'epic'] as const;
export type TradeUpInputRarity = (typeof VALID_TRADE_UP_RARITIES)[number];

export const RARITY_UPGRADES: Record<TradeUpInputRarity, 'rare' | 'epic' | 'legendary'> = {
  common: 'rare',
  rare: 'epic',
  epic: 'legendary',
};

export interface TradeUpOutcome {
  id: string;
  name: string;
  image: string | null;
  rarity: string | null;
  rarityColor: string | null;
  grade: Cs2GradeInfo;
  chestId: string | null;
  chestName: string | null;
  chancePercent: number;
}

export interface TradeUpCollectionPreview {
  chestId: string;
  chestName: string;
  inputCount: number;
  weightPercent: number;
  outcomeCount: number;
  outcomes: {
    id: string;
    name: string;
    image: string | null;
    chancePercent: number;
  }[];
}

export interface TradeUpPreviewResult {
  inputGrade: Cs2GradeInfo;
  targetGrade: Cs2GradeInfo;
  collections: TradeUpCollectionPreview[];
  outcomes: TradeUpOutcome[];
  totalOutcomes: number;
}

export interface TradeUpResult {
  tradeUpId: string;
  targetRarity: 'rare' | 'epic' | 'legendary';
  targetGrade?: Cs2GradeInfo;
  wonItem: RewardRow;
}

/**
 * Resuelve la caja o colección de origen de un objeto.
 */
export function getChestIdForItem(db: Db, itemId: string): { chestId: string; chestName: string } | null {
  // 1. Mirar si el canje del usuario registró una caja específica
  const redemption = db
    .prepare(
      `SELECT r.reward_id as chest_id, rw.name as chest_name
       FROM redemptions r
       JOIN rewards rw ON rw.id = r.reward_id
       WHERE r.won_item_id = ? AND rw.type = 'chest'
       LIMIT 1`
    )
    .get(itemId) as { chest_id: string; chest_name: string } | undefined;

  if (redemption?.chest_id) {
    return { chestId: redemption.chest_id, chestName: redemption.chest_name };
  }

  // 2. Si no, resolver mediante chest_contents
  const content = db
    .prepare(
      `SELECT cc.chest_id, rw.name as chest_name
       FROM chest_contents cc
       JOIN rewards rw ON rw.id = cc.chest_id
       WHERE cc.chest_item_id = ?
       LIMIT 1`
    )
    .get(itemId) as { chest_id: string; chest_name: string } | undefined;

  if (content?.chest_id) {
    return { chestId: content.chest_id, chestName: content.chest_name };
  }

  return null;
}

/**
 * Obtiene los candidatos de salida en una caja que pertenezcan al grado objetivo.
 */
function getCandidatesForChestAndGrade(
  db: Db,
  chestId: string,
  targetGradeId: Cs2GradeId
): RewardRow[] {
  const items = db
    .prepare(
      `SELECT rw.*
       FROM chest_contents cc
       JOIN rewards rw ON rw.id = cc.chest_item_id
       WHERE cc.chest_id = ?`
    )
    .all(chestId) as RewardRow[];

  return items.filter((item) => getCs2Grade(item).id === targetGradeId);
}

/**
 * Calcula las probabilidades en tiempo real de un contrato de 10 skins según
 * las fórmulas proporcionales oficiales de CS2.
 */
export function calculateTradeUpProbabilities(
  db: Db,
  itemIds: string[]
): TradeUpPreviewResult {
  if (!Array.isArray(itemIds) || itemIds.length !== 10) {
    throw new Error('un contrato de intercambio requiere exactamente 10 skins');
  }

  const items: RewardRow[] = [];
  for (const id of itemIds) {
    const item = getRewardById(db, id);
    if (!item) throw new Error(`objeto no encontrado: ${id}`);
    items.push(item);
  }

  const firstGrade = getCs2Grade(items[0]);
  if (!isTradeUpEligible(firstGrade.id)) {
    throw new Error(`el grado ${firstGrade.name} no es elegible como entrada en Trade-Up`);
  }

  for (let i = 1; i < items.length; i++) {
    const currentGrade = getCs2Grade(items[i]);
    if (currentGrade.id !== firstGrade.id) {
      throw new Error(
        `todas las skins deben ser del mismo grado (${firstGrade.name}). Se encontró: ${currentGrade.name}`
      );
    }
  }

  const targetGrade = getNextGrade(firstGrade.id);
  if (!targetGrade) {
    throw new Error(`el grado ${firstGrade.name} no tiene grado superior en el contrato de 10`);
  }

  // Agrupar entradas por caja
  const chestCounts = new Map<string, { chestName: string; count: number }>();
  for (const item of items) {
    const chestInfo = getChestIdForItem(db, item.id) ?? {
      chestId: 'unknown',
      chestName: 'Colección General',
    };
    const prev = chestCounts.get(chestInfo.chestId) ?? {
      chestName: chestInfo.chestName,
      count: 0,
    };
    prev.count += 1;
    chestCounts.set(chestInfo.chestId, prev);
  }

  const collections: TradeUpCollectionPreview[] = [];
  const allOutcomes: TradeUpOutcome[] = [];

  for (const [chestId, info] of chestCounts) {
    const weightPercent = (info.count / 10) * 100;
    let candidates =
      chestId !== 'unknown'
        ? getCandidatesForChestAndGrade(db, chestId, targetGrade.id)
        : [];

    // Si la caja no tiene candidatos del grado objetivo (o era desconocida), fallback a todas las del grado
    if (candidates.length === 0) {
      candidates = (
        db
          .prepare("SELECT * FROM rewards WHERE type = 'chest_item'")
          .all() as RewardRow[]
      ).filter((rw) => getCs2Grade(rw).id === targetGrade.id);
    }

    const candidateCount = candidates.length;
    const perSkinChance = candidateCount > 0 ? weightPercent / candidateCount : 0;

    const collectionOutcomes = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image,
      chancePercent: perSkinChance,
    }));

    collections.push({
      chestId,
      chestName: info.chestName,
      inputCount: info.count,
      weightPercent,
      outcomeCount: candidateCount,
      outcomes: collectionOutcomes,
    });

    for (const c of candidates) {
      const existing = allOutcomes.find((o) => o.id === c.id);
      if (existing) {
        existing.chancePercent += perSkinChance;
      } else {
        allOutcomes.push({
          id: c.id,
          name: c.name,
          image: c.image,
          rarity: c.rarity,
          rarityColor: c.rarity_color,
          grade: getCs2Grade(c),
          chestId,
          chestName: info.chestName,
          chancePercent: perSkinChance,
        });
      }
    }
  }

  allOutcomes.sort((a, b) => b.chancePercent - a.chancePercent || a.name.localeCompare(b.name));

  return {
    inputGrade: firstGrade,
    targetGrade,
    collections,
    outcomes: allOutcomes,
    totalOutcomes: allOutcomes.length,
  };
}

export function executeTradeUp(
  db: Db,
  input: {
    inputGrade?: Cs2GradeId;
    inputRarity?: TradeUpInputRarity;
    itemIds: string[];
    operationId?: string;
  }
): TradeUpResult {
  if (input.operationId) {
    const existing = db
      .prepare('SELECT id, target_rarity, result_reward_id FROM trade_ups WHERE id = ?')
      .get(input.operationId) as
      | { id: string; target_rarity: 'rare' | 'epic' | 'legendary'; result_reward_id: string }
      | undefined;
    if (existing) {
      const wonItem = getRewardById(db, existing.result_reward_id);
      if (wonItem) {
        return {
          tradeUpId: existing.id,
          targetRarity: existing.target_rarity,
          targetGrade: getCs2Grade(wonItem),
          wonItem,
        };
      }
    }
  }

  if (input.inputRarity && !VALID_TRADE_UP_RARITIES.includes(input.inputRarity)) {
    throw new Error(`rareza de entrada invalida: ${input.inputRarity}`);
  }

  if (!Array.isArray(input.itemIds) || input.itemIds.length !== 10) {
    throw new Error('un contrato de intercambio requiere exactamente 10 skins');
  }

  const requestedCounts: Record<string, number> = {};
  for (const id of input.itemIds) {
    if (typeof id !== 'string' || !id) throw new Error('id de objeto invalido');
    requestedCounts[id] = (requestedCounts[id] ?? 0) + 1;
  }

  // Comprobar inventario antes de sortear
  const inventory = listInventory(db);
  const inventoryMap = new Map(inventory.map((item) => [item.id, item]));

  for (const [id, count] of Object.entries(requestedCounts)) {
    const owned = inventoryMap.get(id);
    if (!owned) {
      throw new Error(`no tienes el objeto ${id} en tu inventario`);
    }
    if (owned.count < count) {
      throw new Error(
        `no tienes suficientes copias de ${owned.name} (tienes ${owned.count}, requieres ${count})`
      );
    }
  }

  // Determinar grado y rareza
  const firstItem = inventoryMap.get(input.itemIds[0])!;
  const detectedGrade = getCs2Grade(firstItem);
  const effectiveGradeId = input.inputGrade ?? detectedGrade.id;

  // Si no se especifica inputRarity (flujo CS2), validar que el grado sea elegible para Trade-Up
  if (!input.inputRarity && !TRADE_UP_INPUT_GRADES.includes(effectiveGradeId)) {
    throw new Error(`el grado ${detectedGrade.nameEs} no puede usarse en contratos de intercambio`);
  }

  // Validar que todas las entradas compartan el mismo grado o rareza
  for (const id of input.itemIds) {
    const owned = inventoryMap.get(id)!;
    if (input.inputGrade) {
      const itemGrade = getCs2Grade(owned);
      if (itemGrade.id !== input.inputGrade) {
        throw new Error(`todos los objetos deben ser de grado ${input.inputGrade}`);
      }
    } else if (input.inputRarity) {
      if (owned.rarity !== input.inputRarity) {
        throw new Error(`todos los objetos deben ser de rareza ${input.inputRarity}`);
      }
    } else {
      const itemGrade = getCs2Grade(owned);
      if (itemGrade.id !== detectedGrade.id) {
        throw new Error(`todos los objetos deben ser del mismo grado (${detectedGrade.nameEs})`);
      }
    }
  }

  const targetGrade = getNextGrade(effectiveGradeId);
  const targetRarity: 'rare' | 'epic' | 'legendary' =
    input.inputRarity && RARITY_UPGRADES[input.inputRarity]
      ? RARITY_UPGRADES[input.inputRarity]
      : targetGrade?.id === 'covert' || targetGrade?.id === 'classified'
        ? 'epic'
        : targetGrade?.id === 'restricted'
          ? 'rare'
          : 'rare';

  // Sorteo de salida según fórmula CS2
  let wonItem: RewardRow | null = null;
  const usesGradeFlow = !input.inputRarity;

  let preview: TradeUpPreviewResult | null = null;
  if (usesGradeFlow) {
    // Las validaciones de grado (mezcla, elegibilidad, grado objetivo) se propagan
    preview = calculateTradeUpProbabilities(db, input.itemIds);
  } else {
    try {
      preview = calculateTradeUpProbabilities(db, input.itemIds);
    } catch {
      preview = null; // flujo heredado por rareza tradicional
    }
  }

  if (preview && preview.outcomes.length > 0) {
    // Sorteo uniforme de una de las 10 entradas, luego uniforme en los resultados de su caja
    const randomSlot = Math.floor(Math.random() * 10);
    const chosenItemId = input.itemIds[randomSlot];
    const chestInfo = getChestIdForItem(db, chosenItemId);
    const chosenChestId = chestInfo?.chestId ?? 'unknown';
    const collection = preview.collections.find((c) => c.chestId === chosenChestId);

    if (collection && collection.outcomes.length > 0) {
      const picked = collection.outcomes[Math.floor(Math.random() * collection.outcomes.length)];
      wonItem = getRewardById(db, picked.id);
    } else {
      // Ponderado sobre todos los outcomes
      const roll = Math.random() * 100;
      let cumulative = 0;
      for (const out of preview.outcomes) {
        cumulative += out.chancePercent;
        if (roll <= cumulative) {
          wonItem = getRewardById(db, out.id);
          break;
        }
      }
      if (!wonItem) wonItem = getRewardById(db, preview.outcomes[0].id);
    }
  }

  if (!wonItem) {
    if (usesGradeFlow) {
      throw new Error(`no hay skins disponibles del grado objetivo (${targetGrade?.nameEs ?? 'desconocido'})`);
    }

    const targetCandidates = db
      .prepare(
        "SELECT * FROM rewards WHERE type = 'chest_item' AND rarity = ? ORDER BY RANDOM() LIMIT 1"
      )
      .all(targetRarity) as RewardRow[];

    if (targetCandidates.length === 0) {
      throw new Error(`no hay skins disponibles de rareza ${targetRarity}`);
    }
    wonItem = targetCandidates[0];
  }

  const tradeUpId = input.operationId || randomUUID();
  const redemptionId = randomUUID();
  const now = new Date().toISOString();

  db.transaction(() => {
    const checkStockStmt = db.prepare(
      `SELECT 
        (SELECT COUNT(*) FROM redemptions WHERE won_item_id = ?) -
        (SELECT COUNT(*) FROM item_sales WHERE item_id = ?) AS available`
    );
    const burnItemStmt = db.prepare(
      `INSERT INTO item_sales (id, item_id, item_name, item_rarity, item_image, unit_usd, xp_credited, sold_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?)`
    );

    // 1. Quemar 10 items via item_sales para descontarlos del inventario con chequeo atomico
    for (const [id, count] of Object.entries(requestedCounts)) {
      const owned = inventoryMap.get(id)!;
      const stock = checkStockStmt.get(id, id) as { available: number } | undefined;
      const available = stock?.available ?? 0;
      if (available < count) {
        throw new Error(
          `stock insuficiente para el item: ${owned.name} (disponibles: ${available}, requeridos: ${count})`
        );
      }

      for (let i = 0; i < count; i++) {
        burnItemStmt.run(randomUUID(), id, `[Trade-Up] ${owned.name}`, owned.rarity, owned.image, now);
      }
    }

    // 2. Agregar objeto mejorado a redemptions
    db.prepare(
      `INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity, won_item_image)
       VALUES (?, ?, 0, ?, 'Contrato Trade-Up', ?, ?, ?, ?)`
    ).run(redemptionId, wonItem.id, now, wonItem.id, wonItem.name, wonItem.rarity, wonItem.image);

    // 3. Registrar en trade_ups
    db.prepare(
      'INSERT INTO trade_ups (id, target_rarity, result_reward_id, created_at) VALUES (?, ?, ?, ?)'
    ).run(tradeUpId, targetRarity, wonItem.id, now);
  }).immediate();

  return {
    tradeUpId,
    targetRarity,
    targetGrade: getCs2Grade(wonItem),
    wonItem,
  };
}
