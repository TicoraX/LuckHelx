import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import type { Db } from './db';
import { getRewardById } from './rewards-store';
import { getXpBalance, incrementXpBalance } from './settings-store';
import { getDeterministicSkinPrice } from './skin-prices';

export type SectorMode = 'under' | 'over';
export type UpgradeOutcome = 'won' | 'lost';

export const UPGRADE_MIN_PROBABILITY = 0.0001; // 0.01%
export const UPGRADE_MAX_PROBABILITY = 0.95; // 95%
export const UPGRADE_DEFAULT_EDGE = 0.05; // 5%

export interface UpgradeInputItem {
  id: string;
  name: string;
  rarity: string | null;
  image: string | null;
  valueCents: number; // Centésimas de XP ($1.00 USD = 100 cents)
}

export interface UpgradeTargetItem {
  id: string;
  name: string;
  rarity: string | null;
  image: string | null;
  valueCents: number;
}

export interface UpgradeCalculation {
  inputValueCents: number;
  targetValueCents: number;
  edgeRate: number;
  rawProbability: number;
  probability: number;
  winPercentage: number;
  sectorMode: SectorMode;
  sectorStartAngle: number;
  sectorEndAngle: number;
  sectorSpanAngle: number;
  multiplier: number;
}

export interface ExecuteUpgradeInput {
  inputItemIds?: string[];
  xpSpentCents?: number;
  targetItemId: string;
  sectorMode?: SectorMode;
  clientSeed?: string;
  edgeRate?: number;
  operationId?: string;
}

export interface UpgradeResult {
  upgradeId: string;
  outcome: UpgradeOutcome;
  totalInCents: number;
  targetItem: UpgradeTargetItem;
  calculation: UpgradeCalculation;
  // Sin serverSeed: la semilla sigue activa despues de la tirada, y con ella el cliente
  // calcula la siguiente. Se revela recien cuando exista la rotacion.
  provablyFair: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    hmacHash: string;
    rollFloat: number;
    rollAngle: number;
  };
  createdAt: string;
}

export interface UpgradeRow {
  id: string;
  user_id: string;
  input_items_json: string;
  input_value_cents: number;
  xp_spent_cents: number;
  total_in_cents: number;
  target_item_id: string;
  target_item_name: string;
  target_item_rarity: string | null;
  target_item_image: string | null;
  target_value_cents: number;
  edge_rate: number;
  win_probability: number;
  sector_mode: string;
  sector_start_angle: number;
  sector_end_angle: number;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  hmac_hash: string;
  roll_float: number;
  roll_angle: number;
  outcome: UpgradeOutcome;
  created_at: string;
}

/**
 * Cálculo matemático del Upgrade con House Edge y clamping estricto [0.01%, 95%].
 */
export function calculateUpgradeOdds(
  inputValueCents: number,
  targetValueCents: number,
  edgeRate: number = UPGRADE_DEFAULT_EDGE,
  mode: SectorMode = 'under'
): UpgradeCalculation {
  if (targetValueCents <= 0) {
    throw new Error('targetValueCents debe ser mayor a 0');
  }
  if (inputValueCents <= 0) {
    throw new Error('inputValueCents debe ser mayor a 0');
  }

  const safeEdge = Math.max(0, Math.min(0.2, edgeRate));
  const rawProb = inputValueCents / (targetValueCents * (1 + safeEdge));
  const probability = Math.min(UPGRADE_MAX_PROBABILITY, Math.max(UPGRADE_MIN_PROBABILITY, rawProb));

  const winPercentage = Math.round(probability * 10000) / 100;
  const sectorSpanAngle = Math.round(probability * 360 * 100) / 100;

  let sectorStartAngle = 0;
  let sectorEndAngle = sectorSpanAngle;

  if (mode === 'over') {
    sectorStartAngle = Math.round((360 - sectorSpanAngle) * 100) / 100;
    sectorEndAngle = 360;
  }

  const multiplier = Math.round((targetValueCents / inputValueCents) * 100) / 100;

  return {
    inputValueCents,
    targetValueCents,
    edgeRate: safeEdge,
    rawProbability: rawProb,
    probability,
    winPercentage,
    sectorMode: mode,
    sectorStartAngle,
    sectorEndAngle,
    sectorSpanAngle,
    multiplier,
  };
}

// ==========================================
// Provably Fair Cryptographic Engine (HMAC-SHA256)
// ==========================================

export function generateServerSeed(): string {
  return randomBytes(32).toString('hex');
}

export function hashServerSeed(serverSeed: string): string {
  return createHash('sha256').update(serverSeed).digest('hex');
}

/**
 * Generación determinista sin sesgo de módulo:
 * Toma los primeros 4 bytes (8 hex chars = 32-bit unsigned int) y divide entre 2^32.
 */
export function generateProvablyFairRoll(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  sectorSpanAngle: number,
  mode: SectorMode = 'under'
): {
  hmacHash: string;
  rollFloat: number;
  rollAngle: number;
  isWin: boolean;
} {
  const message = `${clientSeed}:${nonce}`;
  const hmac = createHmac('sha256', serverSeed).update(message).digest('hex');

  // Primeros 8 caracteres hex = entero sin signo de 32 bits
  const int32 = parseInt(hmac.substring(0, 8), 16);
  const uniformFloat = int32 / 4294967296; // [0, 1)

  const rollFloat = Math.round(uniformFloat * 1000000) / 10000; // [0, 100) con 4 decimales
  const rollAngle = Math.round(uniformFloat * 360 * 100) / 100; // [0, 360) con 2 decimales

  let isWin = false;
  if (mode === 'under') {
    isWin = rollAngle < sectorSpanAngle;
  } else {
    isWin = rollAngle >= 360 - sectorSpanAngle;
  }

  return {
    hmacHash: hmac,
    rollFloat,
    rollAngle,
    isWin,
  };
}

export function verifyProvablyFairRoll(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  expectedHmac: string,
  expectedAngle: number
): boolean {
  const message = `${clientSeed}:${nonce}`;
  const hmac = createHmac('sha256', serverSeed).update(message).digest('hex');
  if (hmac !== expectedHmac) return false;

  const int32 = parseInt(hmac.substring(0, 8), 16);
  const uniformFloat = int32 / 4294967296;
  const rollAngle = Math.round(uniformFloat * 360 * 100) / 100;

  return Math.abs(rollAngle - expectedAngle) < 0.01;
}

// ==========================================
// Gestión de Semillas en SQLite
// ==========================================

export function getActiveProvablyFairSeed(
  db: Db,
  defaultClientSeed: string = 'luckhelx_client'
): {
  id: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  currentNonce: number;
} {
  const row = db
    .prepare("SELECT * FROM provably_fair_seeds WHERE status = 'active' LIMIT 1")
    .get() as
    | {
        id: string;
        server_seed: string;
        server_seed_hash: string;
        client_seed: string;
        current_nonce: number;
      }
    | undefined;

  if (!row) {
    const id = randomUUID();
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    db.prepare(
      `INSERT INTO provably_fair_seeds (id, server_seed, server_seed_hash, client_seed, current_nonce, status)
       VALUES (?, ?, ?, ?, 0, 'active')`
    ).run(id, serverSeed, serverSeedHash, defaultClientSeed);

    return {
      id,
      serverSeed,
      serverSeedHash,
      clientSeed: defaultClientSeed,
      currentNonce: 0,
    };
  }

  return {
    id: row.id,
    serverSeed: row.server_seed,
    serverSeedHash: row.server_seed_hash,
    clientSeed: row.client_seed,
    currentNonce: row.current_nonce,
  };
}

// ==========================================
// Ejecución Atómica del Upgrade
// ==========================================

export function executeUpgrade(db: Db, input: ExecuteUpgradeInput): UpgradeResult {
  const edgeRate = input.edgeRate ?? UPGRADE_DEFAULT_EDGE;
  const mode: SectorMode = input.sectorMode === 'over' ? 'over' : 'under';
  const xpSpentCents = Math.max(0, Math.floor(input.xpSpentCents ?? 0));
  const inputItemIds = input.inputItemIds ?? [];
  const upgradeId = input.operationId || randomUUID();
  const now = new Date().toISOString();

  // 1. Obtener la skin objetivo
  const targetReward = getRewardById(db, input.targetItemId);
  if (!targetReward) {
    throw new Error(`Skin objetivo no encontrada: ${input.targetItemId}`);
  }

  // Tasar la skin objetivo usando el motor de precios (en dólares y centésimas de XP)
  const targetPriceRow = db
    .prepare('SELECT usd FROM skin_prices WHERE name = ?')
    .get(targetReward.name) as { usd: number | null } | undefined;
  const targetUsd =
    targetPriceRow && targetPriceRow.usd !== null && targetPriceRow.usd > 0
      ? targetPriceRow.usd
      : getDeterministicSkinPrice(targetReward.name, targetReward.rarity);

  const targetValueCents = Math.max(1, Math.round(targetUsd * 100));

  let result!: UpgradeResult;

  db.transaction(() => {
    // 2. Verificar y descontar XP si se especificó saldo directo
    if (xpSpentCents > 0) {
      const balance = getXpBalance(db);
      if (balance < xpSpentCents) {
        throw new Error(
          `Saldo de XP insuficiente (tienes ${balance} cents, requeridos ${xpSpentCents})`
        );
      }
      incrementXpBalance(db, -xpSpentCents);
    }

    // 3. Verificar y quemar los ítems de entrada
    const inputItems: UpgradeInputItem[] = [];
    let itemsValueCents = 0;

    for (const itemId of inputItemIds) {
      const itemRow = db
        .prepare(
          `SELECT won_item_id as id, won_item_name as name, won_item_rarity as rarity, won_item_image as image
           FROM redemptions
           WHERE won_item_id = ?
           LIMIT 1`
        )
        .get(itemId) as
        | { id: string; name: string; rarity: string | null; image: string | null }
        | undefined;

      if (!itemRow) {
        throw new Error(`Ítem de entrada no encontrado en el registro: ${itemId}`);
      }

      // Verificar stock disponible
      const stock = db
        .prepare(
          `SELECT 
            (SELECT COUNT(*) FROM redemptions WHERE won_item_id = ?) -
            (SELECT COUNT(*) FROM item_sales WHERE item_id = ?) AS available`
        )
        .get(itemId, itemId) as { available: number };

      if (!stock || stock.available <= 0) {
        throw new Error(`Stock insuficiente para el ítem: ${itemRow.name}`);
      }

      // Tasar ítem de entrada
      const priceRow = db.prepare('SELECT usd FROM skin_prices WHERE name = ?').get(itemRow.name) as
        | { usd: number | null }
        | undefined;
      const usd =
        priceRow && priceRow.usd !== null && priceRow.usd > 0
          ? priceRow.usd
          : getDeterministicSkinPrice(itemRow.name, itemRow.rarity);
      const valCents = Math.max(1, Math.round(usd * 100));

      inputItems.push({
        id: itemRow.id,
        name: itemRow.name,
        rarity: itemRow.rarity,
        image: itemRow.image,
        valueCents: valCents,
      });

      itemsValueCents += valCents;

      // Registrar quema en item_sales (xp_credited = 0, unit_usd = 0)
      const saleId = randomUUID();
      db.prepare(
        `INSERT INTO item_sales (id, item_id, item_name, item_rarity, item_image, unit_usd, xp_credited, sold_at)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?)`
      ).run(saleId, itemRow.id, `[Upgrade] ${itemRow.name}`, itemRow.rarity, itemRow.image, now);
    }

    const totalInCents = itemsValueCents + xpSpentCents;
    if (totalInCents <= 0) {
      throw new Error('Debes seleccionar al menos un ítem o aportar saldo de XP');
    }

    // 4. Calcular probabilidades
    const calculation = calculateUpgradeOdds(totalInCents, targetValueCents, edgeRate, mode);

    // 5. Provably Fair Roll
    const seed = getActiveProvablyFairSeed(db, input.clientSeed);
    const nonce = seed.currentNonce + 1;
    const clientSeed = input.clientSeed || seed.clientSeed;

    const roll = generateProvablyFairRoll(
      seed.serverSeed,
      clientSeed,
      nonce,
      calculation.sectorSpanAngle,
      mode
    );

    // Incrementar nonce en base de datos
    db.prepare(
      'UPDATE provably_fair_seeds SET current_nonce = ?, client_seed = ? WHERE id = ?'
    ).run(nonce, clientSeed, seed.id);

    const outcome: UpgradeOutcome = roll.isWin ? 'won' : 'lost';

    // 6. Si gana, adjudicar la skin objetivo en redemptions
    if (outcome === 'won') {
      const redemptionId = randomUUID();
      db.prepare(
        `INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity, won_item_image)
         VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?)`
      ).run(
        redemptionId,
        targetReward.id,
        now,
        `${targetReward.name} (Upgrade)`,
        targetReward.id,
        targetReward.name,
        targetReward.rarity,
        targetReward.image
      );
    }

    // 7. Registrar en el historial inmutable de upgrades
    db.prepare(
      `INSERT INTO upgrades (
        id, user_id, input_items_json, input_value_cents, xp_spent_cents, total_in_cents,
        target_item_id, target_item_name, target_item_rarity, target_item_image, target_value_cents,
        edge_rate, win_probability, sector_mode, sector_start_angle, sector_end_angle,
        server_seed, server_seed_hash, client_seed, nonce, hmac_hash, roll_float, roll_angle,
        outcome, created_at
      ) VALUES (?, 'local_user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      upgradeId,
      JSON.stringify(inputItems),
      itemsValueCents,
      xpSpentCents,
      totalInCents,
      targetReward.id,
      targetReward.name,
      targetReward.rarity,
      targetReward.image,
      targetValueCents,
      calculation.edgeRate,
      calculation.probability,
      mode,
      calculation.sectorStartAngle,
      calculation.sectorEndAngle,
      seed.serverSeed,
      seed.serverSeedHash,
      clientSeed,
      nonce,
      roll.hmacHash,
      roll.rollFloat,
      roll.rollAngle,
      outcome,
      now
    );

    result = {
      upgradeId,
      outcome,
      totalInCents,
      targetItem: {
        id: targetReward.id,
        name: targetReward.name,
        rarity: targetReward.rarity,
        image: targetReward.image,
        valueCents: targetValueCents,
      },
      calculation,
      provablyFair: {
        serverSeedHash: seed.serverSeedHash,
        clientSeed,
        nonce,
        hmacHash: roll.hmacHash,
        rollFloat: roll.rollFloat,
        rollAngle: roll.rollAngle,
      },
      createdAt: now,
    };
  })();

  return result;
}

// Columnas explicitas: `server_seed` queda en la tabla para revelarla al rotar, pero nunca
// sale por aca, que es lo que lee GET /api/upgrade.
export function listUpgrades(db: Db, limit: number = 20): UpgradeRow[] {
  return db
    .prepare(
      `SELECT id, user_id, input_items_json, input_value_cents, xp_spent_cents, total_in_cents,
              target_item_id, target_item_name, target_item_rarity, target_item_image,
              target_value_cents, edge_rate, win_probability, sector_mode, sector_start_angle,
              sector_end_angle, server_seed_hash, client_seed, nonce, hmac_hash, roll_float,
              roll_angle, outcome, created_at
       FROM upgrades ORDER BY created_at DESC, rowid DESC LIMIT ?`
    )
    .all(limit) as UpgradeRow[];
}

export interface UpgradeTargetCatalogItem {
  id: string;
  name: string;
  rarity: string | null;
  image: string | null;
  priceUsd: number;
  valueCents: number;
}

export function listUpgradeTargets(db: Db, limit: number = 60): UpgradeTargetCatalogItem[] {
  const rows = db
    .prepare(
      `SELECT id, name, rarity, image 
       FROM rewards 
       WHERE type = 'chest_item' 
       ORDER BY rowid ASC 
       LIMIT ?`
    )
    .all(limit) as { id: string; name: string; rarity: string | null; image: string | null }[];

  return rows.map((r) => {
    const priceRow = db.prepare('SELECT usd FROM skin_prices WHERE name = ?').get(r.name) as
      | { usd: number | null }
      | undefined;
    const usd =
      priceRow && priceRow.usd !== null && priceRow.usd > 0
        ? priceRow.usd
        : getDeterministicSkinPrice(r.name, r.rarity);
    const valueCents = Math.max(1, Math.round(usd * 100));
    return {
      id: r.id,
      name: r.name,
      rarity: r.rarity,
      image: r.image,
      priceUsd: Math.round(usd * 100) / 100,
      valueCents,
    };
  });
}
