// better-sqlite3 is pinned to ^12.x, not the ^11.3.0 the brief specified.
// Reason: 11.3.0 has no prebuilt binary for Node 26's ABI (modules version 147,
// target=26.4.0) and falls back to a source build via node-gyp, which fails on
// this machine's VS2026/MSVC toolchain (unrecognized `-flto=thin` flag -> LNK1117).
// 12.11.1 ships a prebuilt binary for this ABI and installs cleanly. Verified by
// installing both versions in isolation; see task-1-report.md "Fix pass" section.
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export type Db = InstanceType<typeof Database>;

// Declarado una sola vez porque la migración de más abajo tiene que reconstruir la tabla
// con exactamente esta forma. Dos copias de este DDL se desincronizan a la primera.
const REWARDS_COLUMNS = `
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('shop', 'chest', 'chest_item')),
      name TEXT NOT NULL,
      xp_cost INTEGER NOT NULL CHECK (xp_cost > 0),
      rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
      image TEXT,
      rarity_color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
`;

export function initSchema(db: Db): void {
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      description_normalized TEXT NOT NULL DEFAULT '',
      xp_value INTEGER,
      xp_reasoning TEXT,
      status TEXT NOT NULL DEFAULT 'evaluated' CHECK (status IN ('evaluated', 'credited')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS rewards (${REWARDS_COLUMNS});

    CREATE TABLE IF NOT EXISTS chest_contents (
      chest_id TEXT NOT NULL REFERENCES rewards(id),
      chest_item_id TEXT NOT NULL REFERENCES rewards(id),
      PRIMARY KEY (chest_id, chest_item_id)
    );

    CREATE TABLE IF NOT EXISTS redemptions (
      id TEXT PRIMARY KEY,
      reward_id TEXT NOT NULL REFERENCES rewards(id),
      xp_spent INTEGER NOT NULL,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Unico indice que alguna consulta usa de verdad. deleteReward busca por
    -- \`chest_id = ? OR chest_item_id = ?\`: la PRIMARY KEY (chest_id, chest_item_id) ya
    -- cubre la primera mitad por prefijo, pero la segunda escaneaba las 16.425 filas
    -- enteras (verificado con EXPLAIN QUERY PLAN).
    --
    -- No hay indice sobre rewards(type): listRewards no filtra, trae todo y el filtrado
    -- por tipo pasa en el cliente. Ponerlo ahora seria adorno.
    CREATE INDEX IF NOT EXISTS idx_chest_contents_item ON chest_contents(chest_item_id);
  `);

  migrateRewardsRarityCheck(db);
  migrateRedemptionSnapshots(db);

  const existing = db.prepare('SELECT value FROM meta WHERE key = ?').get('xp_balance');
  if (!existing) {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('xp_balance', '0');
  }
}

// Una fila del historial tiene que seguir diciendo lo que pasó ese día aunque hoy
// renombres la recompensa, así que el nombre y el premio se copian al canjear en vez
// de leerse por JOIN. `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe:
// las columnas se agregan siempre por ALTER, y ese es el único lugar donde están
// declaradas (una sola fuente de verdad, ejercitada también en bases nuevas).
//
// `won_item_id` va sin `REFERENCES rewards(id)` a propósito: es para agrupar y navegar,
// no para renderizar. Con la FK puesta, borrar un objeto ya ganado fallaría con un
// error opaco, y el nombre que el historial necesita ya está copiado en la fila.
const REDEMPTION_SNAPSHOT_COLUMNS: [string, string][] = [
  ['reward_name_snapshot', 'TEXT'],
  ['won_item_id', 'TEXT'],
  ['won_item_name', 'TEXT'],
  ['won_item_rarity', 'TEXT'],
  ['won_item_image', 'TEXT'],
];

// Las bases creadas antes de que existiera la rareza `legendary` llevan el CHECK viejo
// grabado en la tabla, y `CREATE TABLE IF NOT EXISTS` no lo toca. El síntoma es que
// sembrar un cuchillo o un guante falla con SQLITE_CONSTRAINT_CHECK, así que el catálogo
// entero termina sin un solo objeto legendary y la ruleta nunca puede entregar uno.
//
// SQLite no permite alterar un CHECK: la única vía es reconstruir la tabla y copiar.
function migrateRewardsRarityCheck(db: Db): void {
  const table = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'rewards'")
    .get() as { sql: string } | undefined;

  if (!table || table.sql.includes("'legendary'")) return;

  // Las FK quedan apagadas durante el intercambio: `chest_contents` y `redemptions`
  // apuntan a `rewards` por nombre y quedarían colgando entre el DROP y el RENAME.
  // Los ids se copian tal cual, así que ninguna referencia se rompe de verdad.
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE rewards_rebuilt (${REWARDS_COLUMNS});
        INSERT INTO rewards_rebuilt SELECT id, type, name, xp_cost, rarity, image, rarity_color, created_at FROM rewards;
        DROP TABLE rewards;
        ALTER TABLE rewards_rebuilt RENAME TO rewards;
      `);
    })();

    const orphans = db.pragma('foreign_key_check') as unknown[];
    if (orphans.length > 0) {
      throw new Error(`la reconstruccion de rewards dejo ${orphans.length} referencias huerfanas`);
    }
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function migrateRedemptionSnapshots(db: Db): void {
  const present = new Set(
    (db.prepare("PRAGMA table_info('redemptions')").all() as { name: string }[]).map((c) => c.name)
  );

  for (const [name, type] of REDEMPTION_SNAPSHOT_COLUMNS) {
    if (!present.has(name)) db.exec(`ALTER TABLE redemptions ADD COLUMN ${name} ${type}`);
  }

  // Canjes anteriores a esta migración: el mejor nombre disponible es el actual de la
  // recompensa. El objeto que salió de esos cofres no se guardó nunca y queda en NULL.
  db.exec(
    `UPDATE redemptions
     SET reward_name_snapshot = (SELECT name FROM rewards WHERE rewards.id = redemptions.reward_id)
     WHERE reward_name_snapshot IS NULL`
  );
}

// Never `require('electron')` here — see Global Constraints in the plan this file
// came from. The path is always handed in via DB_PATH by electron/main.js; this
// fallback only exists so `next dev`/`npm test`, run outside Electron, still work.
function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  const dir = path.join(process.cwd(), '.local');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'data.db');
}

let singleton: Db | null = null;

export function getDb(): Db {
  if (singleton) return singleton;
  singleton = new Database(resolveDbPath());
  initSchema(singleton);
  return singleton;
}

export function createTestDb(): Db {
  const db = new Database(':memory:');
  initSchema(db);
  return db;
}
