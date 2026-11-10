import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import type { Db } from './db';
import { getRewardById } from './rewards-store';
import { getXpBalance, incrementXpBalance } from './settings-store';
import {
  calculateUpgradeOdds,
  nearestTarget,
  type SectorMode,
  UPGRADE_DEFAULT_EDGE,
  UPGRADE_LIST_LIMIT,
  UPGRADE_MAX_LIST_MULT,
  UPGRADE_MAX_SERVER_MULT,
  UPGRADE_MIN_MULT,
  UPGRADE_MULTIPLIERS,
  type UpgradeCalculation,
  type UpgradeOutcome,
  type UpgradeTargetCatalogItem,
  type UpgradeTargetList,
  valueCentsOf,
} from './upgrade-math';

// Reexporta la logica pura para que quien ya importaba de './upgrade' siga igual.
export * from './upgrade-math';

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

export interface ExecuteUpgradeInput {
  operationId?: string;
  inputItemIds?: string[];
  xpSpentCents?: number;
  targetItemId: string;
  sectorMode?: SectorMode;
  clientSeed?: string;
  edgeRate?: number;
}

export interface UpgradeResult {
  upgradeId: string;
  outcome: UpgradeOutcome;
  totalInCents: number;
  targetItem: UpgradeTargetItem;
  calculation: UpgradeCalculation;
  // Sin serverSeed: la semilla sigue activa despues de la tirada, y con ella el cliente
  // calcula la siguiente. Se revela al rotarla (`rotateProvablyFairSeed`).
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

export interface RevealedSeed {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  finalNonce: number;
  revealedAt: string;
}

/**
 * Revela la semilla activa y abre otra. Mientras esta activa solo se publica su hash, que
 * es el compromiso: revelarla antes dejaria calcular la tirada siguiente, y no revelarla
 * nunca dejaria las tiradas sin forma de verificarse. Con la semilla en mano se recalcula
 * el HMAC de cada tirada que firmo (`verifyProvablyFairRoll`).
 */
export function rotateProvablyFairSeed(db: Db): { revealed: RevealedSeed; nextSeedHash: string } {
  return db.transaction(() => {
    const active = getActiveProvablyFairSeed(db);
    db.prepare(
      "UPDATE provably_fair_seeds SET status = 'revealed', revealed_at = datetime('now') WHERE id = ?"
    ).run(active.id);
    const revealed = getLastRevealedSeed(db);
    if (revealed?.serverSeedHash !== active.serverSeedHash) {
      throw new Error('la semilla activa no quedo revelada');
    }
    const next = getActiveProvablyFairSeed(db, active.clientSeed);
    return { revealed, nextSeedHash: next.serverSeedHash };
  })();
}

export function getLastRevealedSeed(db: Db): RevealedSeed | null {
  const row = db
    .prepare(
      `SELECT server_seed, server_seed_hash, client_seed, current_nonce, revealed_at
       FROM provably_fair_seeds WHERE status = 'revealed'
       ORDER BY revealed_at DESC, rowid DESC LIMIT 1`
    )
    .get() as
    | {
        server_seed: string;
        server_seed_hash: string;
        client_seed: string;
        current_nonce: number;
        revealed_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    serverSeed: row.server_seed,
    serverSeedHash: row.server_seed_hash,
    clientSeed: row.client_seed,
    finalNonce: row.current_nonce,
    revealedAt: row.revealed_at,
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

  // Idempotencia: si ya existe una operacion con este operationId, retornar el resultado previo
  if (input.operationId) {
    const existing = db
      .prepare(
        `SELECT id, outcome, total_in_cents, target_item_id, target_item_name, target_item_rarity, target_item_image, target_value_cents, win_probability, roll_angle, server_seed_hash, client_seed, nonce, hmac_hash, roll_float, created_at
         FROM upgrades WHERE id = ?`
      )
      .get(input.operationId) as
      | {
          id: string;
          outcome: UpgradeOutcome;
          total_in_cents: number;
          target_item_id: string;
          target_item_name: string;
          target_item_rarity: string | null;
          target_item_image: string | null;
          target_value_cents: number;
          win_probability: number;
          roll_angle: number;
          server_seed_hash: string;
          client_seed: string;
          nonce: number;
          hmac_hash: string;
          roll_float: number;
          created_at: string;
        }
      | undefined;

    if (existing) {
      return {
        upgradeId: existing.id,
        outcome: existing.outcome,
        totalInCents: existing.total_in_cents,
        targetItem: {
          id: existing.target_item_id,
          name: existing.target_item_name,
          rarity: existing.target_item_rarity,
          image: existing.target_item_image,
          valueCents: existing.target_value_cents,
        },
        calculation: {
          inputValueCents: existing.total_in_cents,
          targetValueCents: existing.target_value_cents,
          probability: existing.win_probability,
          rawProbability: existing.win_probability,
          winPercentage: Math.round(existing.win_probability * 10000) / 100,
          sectorMode: 'under',
          sectorStartAngle: 0,
          sectorEndAngle: existing.roll_angle,
          sectorSpanAngle: existing.roll_angle,
          multiplier: Math.max(
            1,
            Math.round((existing.target_value_cents / Math.max(1, existing.total_in_cents)) * 100) /
              100
          ),
          edgeRate: 0.05,
        },
        provablyFair: {
          serverSeedHash: existing.server_seed_hash,
          clientSeed: existing.client_seed,
          nonce: existing.nonce,
          hmacHash: existing.hmac_hash,
          rollFloat: existing.roll_float,
          rollAngle: existing.roll_angle,
        },
        createdAt: existing.created_at,
      };
    }
  }

  // 1. Obtener la skin objetivo
  const targetReward = getRewardById(db, input.targetItemId);
  if (!targetReward) {
    throw new Error(`Skin objetivo no encontrada: ${input.targetItemId}`);
  }
  // Solo los items ganables del catalogo; un id de tienda o de cofre no es una skin objetivo.
  if (targetReward.type !== 'chest_item') {
    throw new Error('El objetivo debe ser una skin del catalogo');
  }

  const targetPriceRow = db
    .prepare('SELECT usd FROM skin_prices WHERE name = ?')
    .get(targetReward.name) as { usd: number | null } | undefined;
  const targetValueCents = valueCentsOf(
    targetPriceRow?.usd,
    targetReward.name,
    targetReward.rarity
  );

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
      const valCents = valueCentsOf(priceRow?.usd, itemRow.name, itemRow.rarity);

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

    // Rango del objetivo: lanzar aca revierte la transaccion (sin quema, sin XP, sin nonce)
    if (targetValueCents <= totalInCents) {
      throw new Error('El objetivo debe valer mas que lo que apuestas');
    }
    if (targetValueCents > totalInCents * UPGRADE_MAX_SERVER_MULT) {
      throw new Error(`El objetivo no puede valer mas de ${UPGRADE_MAX_SERVER_MULT}x lo apostado`);
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
  }).immediate();

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

const emptyByMultiplier = (): Record<string, UpgradeTargetCatalogItem | null> =>
  Object.fromEntries(UPGRADE_MULTIPLIERS.map((m) => [String(m), null]));

export function listUpgradeTargets(
  db: Db,
  opts: { entryCents: number; q?: string; limit?: number }
): UpgradeTargetList {
  const { entryCents, q } = opts;
  const limit = opts.limit ?? UPGRADE_LIST_LIMIT;
  if (!(entryCents > 0)) {
    return { items: [], total: 0, maxValueCents: 0, byMultiplier: emptyByMultiplier() };
  }

  const rows = db
    .prepare(
      `SELECT r.id, r.name, r.rarity, r.rarity_color as rarityColor, r.image, p.usd AS usd
       FROM rewards r
       LEFT JOIN skin_prices p ON p.name = r.name
       WHERE r.type = 'chest_item'
       ORDER BY r.rowid ASC`
    )
    .all() as {
    id: string;
    name: string;
    rarity: string | null;
    rarityColor: string | null;
    image: string | null;
    usd: number | null;
  }[];

  const lo = entryCents * UPGRADE_MIN_MULT;
  const hi = entryCents * UPGRADE_MAX_LIST_MULT;
  const needle = q?.toLowerCase();
  const seen = new Set<string>();
  const inRange: UpgradeTargetCatalogItem[] = [];
  const allInRange: UpgradeTargetCatalogItem[] = []; // sin q: base de byMultiplier
  let maxValueCents = 0;

  for (const r of rows) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    const valueCents = valueCentsOf(r.usd, r.name, r.rarity);
    if (valueCents > maxValueCents) maxValueCents = valueCents;
    if (valueCents <= lo || valueCents > hi) continue;
    const isReal = r.usd !== null && r.usd > 0;
    const entry: UpgradeTargetCatalogItem = {
      id: r.id,
      name: r.name,
      rarity: r.rarity,
      rarityColor: r.rarityColor,
      image: r.image,
      priceUsd: Math.round((isReal ? (r.usd as number) : valueCents / 100) * 100) / 100,
      valueCents,
      priceIsFallback: !isReal,
    };
    allInRange.push(entry);
    if (needle && !r.name.toLowerCase().includes(needle)) continue;
    inRange.push(entry);
  }

  inRange.sort((a, b) => a.valueCents - b.valueCents);
  const total = inRange.length;
  let items = inRange;
  if (total > limit) {
    // Muestra repartida por cuantiles: cubre todo el rango en vez de los `limit` mas baratos.
    items =
      limit === 1
        ? [inRange[0]]
        : Array.from(
            { length: limit },
            (_, i) => inRange[Math.round((i * (total - 1)) / (limit - 1))]
          );
  }
  // El mas cercano a entrada x m sobre TODO el rango (sin q ni muestreo): la muestra de 48
  // no contiene el valor pedido y el boton elegiria uno lejano.
  const byMultiplier = emptyByMultiplier();
  for (const m of UPGRADE_MULTIPLIERS) {
    const goal = entryCents * m;
    byMultiplier[String(m)] = goal > maxValueCents ? null : nearestTarget(allInRange, goal);
  }
  return { items, total, maxValueCents, byMultiplier };
}
