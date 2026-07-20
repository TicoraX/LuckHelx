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

export function initSchema(db: Db): void {
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

    CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('shop', 'chest', 'chest_item')),
      name TEXT NOT NULL,
      xp_cost INTEGER NOT NULL CHECK (xp_cost > 0),
      rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS redemptions (
      id TEXT PRIMARY KEY,
      reward_id TEXT NOT NULL REFERENCES rewards(id),
      xp_spent INTEGER NOT NULL,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const existing = db.prepare('SELECT value FROM meta WHERE key = ?').get('xp_balance');
  if (!existing) {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('xp_balance', '0');
  }
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
