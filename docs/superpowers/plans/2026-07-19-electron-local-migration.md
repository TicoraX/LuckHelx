# Electron Local Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase (Postgres/Auth/RLS) with a local SQLite file and package the app as an Electron desktop app — no accounts, no cloud dependency, DeepSeek key entered once via a settings screen.

**Architecture:** Electron wraps the existing Next.js app unchanged (API routes = backend, pages/components = frontend). `better-sqlite3` (synchronous, single Node process) replaces Postgres; atomicity comes from JS's single-threaded execution wrapped in `db.transaction()`, not SQL-level RPCs. Auth is removed entirely — single local user, no `user_id` anywhere.

**Tech Stack:** Next.js 14 (unchanged), `better-sqlite3`, Electron, `electron-builder`, TypeScript, Vitest.

## Global Constraints

- Zero cross-device sync, zero multi-user support (spec: out of scope).
- Zero auto-update/code-signing infrastructure — unpacked/portable build only (spec: YAGNI for a personal tool).
- `lib/db.ts` must NEVER `require('electron')` — when Next.js's own process runs outside Electron (plain `next dev`, `npm test`), `require('electron')` returns a path *string*, not the API, and calling `.getPath()` on it crashes. The DB path is always passed in via `process.env.DB_PATH`, set only by `electron/main.js` (which *does* run inside Electron and can safely use the API), with a plain-filesystem fallback for non-Electron dev/test use.
- No visual/CSS changes to `/rewards` or any other page in this plan — that's a separate, already-deferred piece of work (see `docs/superpowers/specs/2026-07-19-electron-local-migration-design.md`, "Out of scope").
- Every task ends with `npm test` and (where relevant) `npm run build` passing before commit.

---

## File Structure

**New:**
- `lib/db.ts` — SQLite connection singleton + schema init.
- `lib/settings-store.ts` — `meta` key-value table (XP balance, DeepSeek key).
- `lib/tasks-store.ts` — tasks CRUD + cache-by-description lookup.
- `lib/rewards-store.ts` — rewards CRUD + atomic redeem + redemption count.
- `app/api/state/route.ts` — `GET` dashboard state (XP balance, tasks, redemption count).
- `app/api/rewards/route.ts` — `GET` list rewards, `POST` create reward.
- `app/api/settings/route.ts` — `GET`/`POST` DeepSeek key.
- `components/SettingsModal.tsx` — paste-your-DeepSeek-key modal.
- `electron/main.js` — Electron entry point.
- `.gitignore` additions for `dist/`, `out/`, `.local/`.

**Modified:**
- `lib/deepseek.ts` — `evaluateTask` takes the API key as a parameter instead of reading `process.env.DEEPSEEK_API_KEY`.
- `lib/sync.ts` — `evaluateAndCacheXp` drops its rate-limit branch, uses `tasks-store` instead of Supabase.
- `app/api/tasks/create/route.ts`, `app/api/tasks/complete/route.ts`, `app/api/redeem/route.ts` — swap Supabase for the new stores.
- `app/page.tsx`, `app/rewards/page.tsx` — remove auth/session logic, fetch from the new API routes, remove "Salir", add a settings entry point.
- `next.config.js` — remove `next-pwa`, add `output: 'standalone'`.
- `app/layout.tsx` — remove the PWA manifest `<link>`.
- `package.json` — remove Supabase/PWA deps, add SQLite/Electron deps and scripts.

**Deleted (Task 16, once nothing references them):**
- `app/login/page.tsx`, `app/auth/callback/route.ts`
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/route-auth.ts`
- `supabase/` (entire directory — migrations, config)
- `app/api/cron/`, `app/api/sync-now/` (already-empty leftover directories)
- `.env.example`
- `public/manifest.json`

---

### Task 1: SQLite connection + schema

**Files:**
- Create: `lib/db.ts`
// electron/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
let activePort = null;

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No se pudo reservar un puerto de inicio')));
        return;
      }

      const port = address.port;
      server.close((closeError) => {
        if (closeError) reject(closeError);
        else resolve(port);
      });
    });
  });
}

function waitForServer(port, callback) {
  const attempt = () => {
    http
      .get({ hostname: '127.0.0.1', port, path: '/api/state' }, (response) => {
        response.resume();
        if (response.statusCode >= 200 && response.statusCode < 300) {
          callback();
          return;
        }
        setTimeout(attempt, 300);
      })
      .on('error', () => setTimeout(attempt, 300));
  };
  attempt();
}

function createWindow() {
  if (activePort === null) return;
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(`http://127.0.0.1:${activePort}`);
}

app.whenReady().then(async () => {
  process.env.DB_PATH = path.join(app.getPath('userData'), 'data.db');
  activePort = await getAvailablePort();

  if (isDev) {
    // In dev, Electron owns the Next.js process so DB_PATH is set before `next dev` starts.
    const child = spawn('npm', ['run', 'dev'], {
      env: {
        ...process.env,
        DB_PATH: process.env.DB_PATH,
        ELECTRON_RUN_AS_NODE: '1',
        HOSTNAME: '127.0.0.1',
        PORT: String(activePort),
      },
      stdio: 'inherit',
      shell: true,
    });
    app.on('before-quit', () => child.kill());
    waitForServer(activePort, createWindow);
  } else {
    // Packaged build: spawn the standalone Next.js server bundled alongside this app.
    const serverPath = path.join(process.resourcesPath, 'standalone', 'server.js');
    const child = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        HOSTNAME: '127.0.0.1',
        PORT: String(activePort),
        NODE_ENV: 'production',
      },
      stdio: 'inherit',
    });
    app.on('before-quit', () => child.kill());
    waitForServer(activePort, createWindow);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && activePort !== null) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
- [ ] **Step 4: Write the implementation**

```typescript
// lib/db.ts
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export type Db = InstanceType<typeof Database>;

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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/db.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Add `.local/` to `.gitignore`**

```bash
echo ".local/" >> .gitignore
```

- [ ] **Step 7: Commit**

```bash
git add lib/db.ts lib/db.test.ts package.json package-lock.json .gitignore
git commit -m "feat: add local SQLite connection and schema"
```

---

### Task 2: Settings store (XP balance, DeepSeek key)

**Files:**
- Create: `lib/settings-store.ts`
- Test: `lib/settings-store.test.ts`

**Interfaces:**
- Consumes: `Db`, `createTestDb` from `./db` (Task 1).
- Produces: `getXpBalance(db: Db): number`, `incrementXpBalance(db: Db, amount: number): number` (returns new balance), `getDeepseekKey(db: Db): string | null`, `setDeepseekKey(db: Db, key: string): void`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/settings-store.test.ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { getXpBalance, incrementXpBalance, getDeepseekKey, setDeepseekKey } from './settings-store';

describe('settings-store', () => {
  it('starts at 0 xp', () => {
    const db = createTestDb();
    expect(getXpBalance(db)).toBe(0);
  });

  it('increments and persists the balance', () => {
    const db = createTestDb();
    expect(incrementXpBalance(db, 40)).toBe(40);
    expect(incrementXpBalance(db, -15)).toBe(25);
    expect(getXpBalance(db)).toBe(25);
  });

  it('has no deepseek key by default, then stores one', () => {
    const db = createTestDb();
    expect(getDeepseekKey(db)).toBeNull();
    setDeepseekKey(db, 'sk-test-123');
    expect(getDeepseekKey(db)).toBe('sk-test-123');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/settings-store.test.ts`
Expected: FAIL with "Cannot find module './settings-store'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/settings-store.ts
import type { Db } from './db';

function getMeta(db: Db, key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setMeta(db: Db, key: string, value: string): void {
  db.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

export function getXpBalance(db: Db): number {
  return Number(getMeta(db, 'xp_balance') ?? '0');
}

export function incrementXpBalance(db: Db, amount: number): number {
  const next = getXpBalance(db) + amount;
  setMeta(db, 'xp_balance', String(next));
  return next;
}

export function getDeepseekKey(db: Db): string | null {
  return getMeta(db, 'deepseek_api_key');
}

export function setDeepseekKey(db: Db, key: string): void {
  setMeta(db, 'deepseek_api_key', key);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/settings-store.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/settings-store.ts lib/settings-store.test.ts
git commit -m "feat: add local settings store for xp balance and deepseek key"
```

---

### Task 3: Tasks store

**Files:**
- Create: `lib/tasks-store.ts`
- Test: `lib/tasks-store.test.ts`

**Interfaces:**
- Consumes: `Db`, `createTestDb` from `./db`; `incrementXpBalance` from `./settings-store` (Task 2).
- Produces:
  ```typescript
  export interface TaskRow {
    id: string;
    title: string;
    description: string;
    description_normalized: string;
    xp_value: number | null;
    xp_reasoning: string | null;
    status: 'evaluated' | 'credited';
    created_at: string;
    completed_at: string | null;
  }
  export function listTasks(db: Db): TaskRow[]
  export function findCachedXp(db: Db, descriptionNormalized: string): { xp_value: number; xp_reasoning: string } | null
  export function insertTask(db: Db, input: { title: string; description: string; descriptionNormalized: string; xpValue: number; xpReasoning: string }): TaskRow
  export function getTaskById(db: Db, id: string): TaskRow | null
  export function completeTask(db: Db, id: string): TaskRow  // throws if not found or already credited
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// lib/tasks-store.test.ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { getXpBalance } from './settings-store';
import { listTasks, findCachedXp, insertTask, getTaskById, completeTask } from './tasks-store';

describe('tasks-store', () => {
  it('inserts a task and lists it back, newest first', () => {
    const db = createTestDb();
    insertTask(db, { title: 'a', description: '', descriptionNormalized: 'a', xpValue: 10, xpReasoning: 'r' });
    insertTask(db, { title: 'b', description: '', descriptionNormalized: 'b', xpValue: 20, xpReasoning: 'r' });
    const rows = listTasks(db);
    expect(rows.map((r) => r.title)).toEqual(['b', 'a']);
    const net = require('net');
    expect(rows[0].status).toBe('evaluated');
  });

    let activePort = null;

    function getAvailablePort() {
      return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          if (!address || typeof address === 'string') {
            server.close(() => reject(new Error('No se pudo reservar un puerto de inicio')));
            return;
          }

          const port = address.port;
          server.close((closeError) => {
            if (closeError) reject(closeError);
            else resolve(port);
          });
        });
      });
    }
    const db = createTestDb();
    function waitForServer(port, callback) {
    expect(findCachedXp(db, 'lavar platos')).toEqual({ xp_value: 15, xp_reasoning: 'ya evaluado' });
    expect(findCachedXp(db, 'algo distinto')).toBeNull();
          .get({ hostname: '127.0.0.1', port, path: '/api/state' }, (response) => {
            response.resume();
            if (response.statusCode >= 200 && response.statusCode < 300) {
              callback();
              return;
            }
            setTimeout(attempt, 300);
          })

  it('completing a task credits it and awards its xp exactly once', () => {
    const db = createTestDb();
    const task = insertTask(db, { title: 'a', description: '', descriptionNormalized: 'a', xpValue: 30, xpReasoning: 'r' });
    const credited = completeTask(db, task.id);
    expect(credited.status).toBe('credited');
      if (activePort === null) return;
    expect(credited.completed_at).not.toBeNull();
    expect(getXpBalance(db)).toBe(30);
    expect(() => completeTask(db, task.id)).toThrow(/ya fue acreditada/);
    expect(getXpBalance(db)).toBe(30); // unchanged by the rejected second call
  });
      win.loadURL(`http://127.0.0.1:${activePort}`);
  it('throws when completing a task that does not exist', () => {
    const db = createTestDb();
    expect(() => completeTask(db, 'nope')).toThrow(/no encontrada/);
  });
      activePort = await getAvailablePort();

  it('getTaskById returns null for a missing id', () => {
    const db = createTestDb();
    expect(getTaskById(db, 'nope')).toBeNull();
          env: { ...process.env, DB_PATH: process.env.DB_PATH, ELECTRON_RUN_AS_NODE: '1', HOSTNAME: '127.0.0.1', PORT: String(activePort) },
});
```

- [ ] **Step 2: Run test to verify it fails**
        waitForServer(activePort, createWindow);
Run: `npx vitest run lib/tasks-store.test.ts`
Expected: FAIL with "Cannot find module './tasks-store'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/tasks-store.ts
import { randomUUID } from 'crypto';
            PORT: String(activePort),
import { incrementXpBalance } from './settings-store';

export interface TaskRow {
  id: string;
  title: string;
        waitForServer(activePort, createWindow);
  description_normalized: string;
  xp_value: number | null;
  xp_reasoning: string | null;
  status: 'evaluated' | 'credited';
  created_at: string;
  completed_at: string | null;
}

export function listTasks(db: Db): TaskRow[] {
  return db.prepare('SELECT * FROM tasks ORDER BY created_at DESC, rowid DESC').all() as TaskRow[];
}

export function findCachedXp(db: Db, descriptionNormalized: string): { xp_value: number; xp_reasoning: string } | null {
  const row = db
    .prepare('SELECT xp_value, xp_reasoning FROM tasks WHERE description_normalized = ? AND xp_value IS NOT NULL LIMIT 1')
    .get(descriptionNormalized) as { xp_value: number; xp_reasoning: string } | undefined;
  return row ?? null;
}

export function insertTask(
  db: Db,
  input: { title: string; description: string; descriptionNormalized: string; xpValue: number; xpReasoning: string }
): TaskRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO tasks (id, title, description, description_normalized, xp_value, xp_reasoning, status)
     VALUES (?, ?, ?, ?, ?, ?, 'evaluated')`
  ).run(id, input.title, input.description, input.descriptionNormalized, input.xpValue, input.xpReasoning);
  return getTaskById(db, id)!;
}

export function getTaskById(db: Db, id: string): TaskRow | null {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  return row ?? null;
}

export function completeTask(db: Db, id: string): TaskRow {
  const task = getTaskById(db, id);
  if (!task) throw new Error('tarea no encontrada');
  if (task.status === 'credited') throw new Error('esta tarea ya fue acreditada');

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`UPDATE tasks SET status = 'credited', completed_at = ? WHERE id = ?`).run(now, id);
    incrementXpBalance(db, task.xp_value ?? 0);
  });
  tx();

  return getTaskById(db, id)!;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/tasks-store.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/tasks-store.ts lib/tasks-store.test.ts
git commit -m "feat: add local tasks store with cache lookup and atomic completion"
```

---

### Task 4: Rewards store (atomic redeem)

**Files:**
- Create: `lib/rewards-store.ts`
- Test: `lib/rewards-store.test.ts`

**Interfaces:**
- Consumes: `Db`, `createTestDb` from `./db`; `getXpBalance`, `incrementXpBalance` from `./settings-store` (Task 2).
- Produces:
  ```typescript
  export interface RewardRow {
    id: string;
    type: 'shop' | 'chest' | 'chest_item';
    name: string;
    xp_cost: number;
    rarity: 'common' | 'rare' | 'epic' | null;
    created_at: string;
  }
  export function listRewards(db: Db): RewardRow[]
  export function insertReward(db: Db, input: { type: RewardRow['type']; name: string; xpCost: number; rarity: RewardRow['rarity'] }): RewardRow
  export function getRewardById(db: Db, id: string): RewardRow | null
  export function countRedemptions(db: Db): number
  export function redeemIfSufficient(db: Db, rewardId: string): RewardRow | null  // null means insufficient xp; throws if reward not found
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// lib/rewards-store.test.ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { getXpBalance, incrementXpBalance } from './settings-store';
import { listRewards, insertReward, getRewardById, countRedemptions, redeemIfSufficient } from './rewards-store';

describe('rewards-store', () => {
  it('inserts and lists rewards, oldest first', () => {
    const db = createTestDb();
    insertReward(db, { type: 'shop', name: 'a', xpCost: 10, rarity: null });
    insertReward(db, { type: 'shop', name: 'b', xpCost: 20, rarity: null });
    expect(listRewards(db).map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('redeems successfully when balance is sufficient, deducting exactly the cost', () => {
    const db = createTestDb();
    incrementXpBalance(db, 50);
    const reward = insertReward(db, { type: 'shop', name: 'coffee', xpCost: 30, rarity: null });

    const redeemed = redeemIfSufficient(db, reward.id);

    expect(redeemed?.name).toBe('coffee');
    expect(getXpBalance(db)).toBe(20);
    expect(countRedemptions(db)).toBe(1);
  });

  it('rejects redeeming twice when the balance only covers it once', () => {
    const db = createTestDb();
    incrementXpBalance(db, 30);
    const reward = insertReward(db, { type: 'shop', name: 'coffee', xpCost: 30, rarity: null });

    expect(redeemIfSufficient(db, reward.id)).not.toBeNull();
    expect(redeemIfSufficient(db, reward.id)).toBeNull(); // balance is now 0, second call must fail
    expect(getXpBalance(db)).toBe(0); // unchanged by the rejected second call
    expect(countRedemptions(db)).toBe(1);
  });

  it('throws when redeeming a reward that does not exist', () => {
    const db = createTestDb();
    expect(() => redeemIfSufficient(db, 'nope')).toThrow(/no encontrada/);
  });

  it('getRewardById returns null for a missing id', () => {
    const db = createTestDb();
    expect(getRewardById(db, 'nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/rewards-store.test.ts`
Expected: FAIL with "Cannot find module './rewards-store'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/rewards-store.ts
import { randomUUID } from 'crypto';
import type { Db } from './db';
import { getXpBalance, incrementXpBalance } from './settings-store';

export interface RewardRow {
  id: string;
  type: 'shop' | 'chest' | 'chest_item';
  name: string;
  xp_cost: number;
  rarity: 'common' | 'rare' | 'epic' | null;
  created_at: string;
}

export function listRewards(db: Db): RewardRow[] {
  return db.prepare('SELECT * FROM rewards ORDER BY created_at ASC, rowid ASC').all() as RewardRow[];
}

export function insertReward(
  db: Db,
  input: { type: RewardRow['type']; name: string; xpCost: number; rarity: RewardRow['rarity'] }
): RewardRow {
  const id = randomUUID();
  db.prepare('INSERT INTO rewards (id, type, name, xp_cost, rarity) VALUES (?, ?, ?, ?, ?)').run(
    id,
    input.type,
    input.name,
    input.xpCost,
    input.rarity
  );
  return getRewardById(db, id)!;
}

export function getRewardById(db: Db, id: string): RewardRow | null {
  const row = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id) as RewardRow | undefined;
  return row ?? null;
}

export function countRedemptions(db: Db): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM redemptions').get() as { count: number };
  return row.count;
}

export function redeemIfSufficient(db: Db, rewardId: string): RewardRow | null {
  const reward = getRewardById(db, rewardId);
  if (!reward) throw new Error('recompensa no encontrada');

  let redeemed: RewardRow | null = null;
  const tx = db.transaction(() => {
    if (getXpBalance(db) < reward.xp_cost) return;
    incrementXpBalance(db, -reward.xp_cost);
    db.prepare('INSERT INTO redemptions (id, reward_id, xp_spent) VALUES (?, ?, ?)').run(
      randomUUID(),
      reward.id,
      reward.xp_cost
    );
    redeemed = reward;
  });
  tx();

  return redeemed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/rewards-store.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/rewards-store.ts lib/rewards-store.test.ts
git commit -m "feat: add local rewards store with atomic redeem"
```

---

### Task 5: DeepSeek key as a parameter, not an env var

**Files:**
- Modify: `lib/deepseek.ts`
- Modify: `lib/deepseek.test.ts`

**Interfaces:**
- Produces: `evaluateTask(input: { title: string; description: string }, apiKey: string): Promise<{ xp: number; reasoning: string }>` (signature change — second parameter added).

- [ ] **Step 1: Update the test to pass a key explicitly**

```typescript
// lib/deepseek.test.ts
import { describe, it, expect, vi } from 'vitest';
import { evaluateTask } from './deepseek';

describe('evaluateTask', () => {
  it('parses a valid DeepSeek response and returns clamped xp', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ xp: 30, reasoning: 'tarea de dificultad media' }) } }],
      }),
    }) as any;

    const result = await evaluateTask({ title: 'Lavar los platos', description: 'lavar toda la cocina' }, 'test-key');

    expect(result).toEqual({ xp: 30, reasoning: 'tarea de dificultad media' });
  });

  it('clamps an out-of-range xp from the model', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ xp: 999999, reasoning: 'exagerado' }) } }],
      }),
    }) as any;

    const result = await evaluateTask({ title: 'x', description: 'y' }, 'test-key');

    expect(result.xp).toBe(100);
  });

  it('falls back to MIN_XP when the model response is not valid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'no soy json' } }],
      }),
    }) as any;

    const result = await evaluateTask({ title: 'x', description: 'y' }, 'test-key');

    expect(result.xp).toBe(5);
    expect(result.reasoning).toMatch(/no se pudo evaluar/i);
  });

  it('sends the given api key as the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ xp: 10, reasoning: 'r' }) } }] } as any),
    });
    global.fetch = fetchMock as any;

    await evaluateTask({ title: 'x', description: 'y' }, 'my-secret-key');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer my-secret-key');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/deepseek.test.ts`
Expected: FAIL — `evaluateTask` called with 2 args but only accepts 1 (TS error) and the last test's assertion fails since the current implementation reads `process.env.DEEPSEEK_API_KEY`, not the passed key.

- [ ] **Step 3: Update the implementation**

```typescript
// lib/deepseek.ts
import { clampXp } from './xp';

const SYSTEM_PROMPT = `Eres un evaluador de tareas cotidianas. Dado un titulo y descripcion de tarea,
responde SOLO con un JSON de la forma {"xp": number, "reasoning": string}.
El xp debe estar entre 5 y 100 segun la dificultad/tiempo estimado de la tarea.
Se escéptico: descripciones exageradas o vagas no deben recibir xp alto.`;

export async function evaluateTask(
  input: { title: string; description: string },
  apiKey: string
): Promise<{ xp: number; reasoning: string }> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Titulo: ${input.title}\nDescripcion: ${input.description}` },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    return { xp: clampXp(NaN), reasoning: 'no se pudo evaluar: la API de DeepSeek respondio con error' };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  try {
    const parsed = JSON.parse(content);
    return { xp: clampXp(Number(parsed.xp)), reasoning: String(parsed.reasoning ?? '') };
  } catch {
    return { xp: clampXp(NaN), reasoning: 'no se pudo evaluar: respuesta invalida del modelo' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/deepseek.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/deepseek.ts lib/deepseek.test.ts
git commit -m "refactor: pass the DeepSeek api key as a parameter instead of an env var"
```

---

### Task 6: Simplify `evaluateAndCacheXp` (drop the rate limit, use the local tasks store)

**Files:**
- Modify: `lib/sync.ts`
- Create: `lib/sync.test.ts`

**Interfaces:**
- Consumes: `Db` from `./db`; `findCachedXp` from `./tasks-store` (Task 3); `evaluateTask` from `./deepseek` (Task 5); `normalizeDescription` from `./xp` (unchanged).
- Produces: `evaluateAndCacheXp(db: Db, apiKey: string, task: { title: string; description: string }): Promise<{ xpValue: number; xpReasoning: string; normalized: string }>` (signature change — no longer takes a Supabase client or a profile/rate-limit object).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/sync.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createTestDb } from './db';
import { insertTask } from './tasks-store';
import { evaluateAndCacheXp } from './sync';
import * as deepseek from './deepseek';

describe('evaluateAndCacheXp', () => {
  it('calls DeepSeek and returns its result when nothing is cached', async () => {
    const db = createTestDb();
    vi.spyOn(deepseek, 'evaluateTask').mockResolvedValue({ xp: 42, reasoning: 'nueva evaluacion' });

    const result = await evaluateAndCacheXp(db, 'key', { title: 'Tarea nueva', description: 'algo distinto' });

    expect(result.xpValue).toBe(42);
    expect(result.xpReasoning).toBe('nueva evaluacion');
    expect(deepseek.evaluateTask).toHaveBeenCalledTimes(1);
  });

  it('returns the cached value without calling DeepSeek again for the same description', async () => {
    const db = createTestDb();
    insertTask(db, {
      title: 'Ya evaluada',
      description: 'lavar platos',
      descriptionNormalized: 'lavar platos',
      xpValue: 15,
      xpReasoning: 'ya evaluado antes',
    });
    const spy = vi.spyOn(deepseek, 'evaluateTask');

    const result = await evaluateAndCacheXp(db, 'key', { title: 'Lavar Platos', description: 'lavar platos' });

    expect(result.xpValue).toBe(15);
    expect(result.xpReasoning).toBe('ya evaluado antes');
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/sync.test.ts`
Expected: FAIL — current `evaluateAndCacheXp` still expects `(supabase, profile, task)`, not `(db, apiKey, task)`.

- [ ] **Step 3: Update the implementation**

```typescript
// lib/sync.ts
import type { Db } from './db';
import { findCachedXp } from './tasks-store';
import { evaluateTask } from './deepseek';
import { normalizeDescription } from './xp';

export async function evaluateAndCacheXp(
  db: Db,
  apiKey: string,
  task: { title: string; description: string }
): Promise<{ xpValue: number; xpReasoning: string; normalized: string }> {
  const normalized = normalizeDescription(task.description || task.title);

  const cached = findCachedXp(db, normalized);
  if (cached) {
    return { xpValue: cached.xp_value, xpReasoning: cached.xp_reasoning, normalized };
  }

  const evaluated = await evaluateTask({ title: task.title, description: task.description }, apiKey);
  return { xpValue: evaluated.xp, xpReasoning: evaluated.reasoning, normalized };
}
```

Note: this deletes the entire `syncProfileTasks` function and the `SyncProfile`/`DAILY_LIMIT` machinery that were already unused after the earlier Google Tasks removal (`SyncProfile`'s only remaining field, `deepseek_calls_today`/`deepseek_calls_date`, no longer applies — there is no rate limit).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/sync.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/sync.ts lib/sync.test.ts
git commit -m "refactor: drop deepseek rate limit, back evaluateAndCacheXp with local db"
```

---

### Task 7: Rewrite `app/api/tasks/create`

**Files:**
- Modify: `app/api/tasks/create/route.ts`

**Interfaces:**
- Consumes: `getDb` from `@/lib/db`; `getDeepseekKey` from `@/lib/settings-store`; `insertTask` from `@/lib/tasks-store`; `evaluateAndCacheXp` from `@/lib/sync` (Task 6 signature).

- [ ] **Step 1: Replace the route**

```typescript
// app/api/tasks/create/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getDeepseekKey } from '@/lib/settings-store';
import { insertTask } from '@/lib/tasks-store';
import { evaluateAndCacheXp } from '@/lib/sync';

export async function POST(request: Request) {
  const { title, description } = await request.json();
  if (typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'title invalido' }, { status: 400 });
  }

  const db = getDb();
  const apiKey = getDeepseekKey(db);
  if (!apiKey) {
    return NextResponse.json({ error: 'configura tu clave de DeepSeek primero' }, { status: 400 });
  }

  const taskInput = { title: title.trim(), description: typeof description === 'string' ? description : '' };
  const { xpValue, xpReasoning, normalized } = await evaluateAndCacheXp(db, apiKey, taskInput);

  const row = insertTask(db, {
    title: taskInput.title,
    description: taskInput.description,
    descriptionNormalized: normalized,
    xpValue,
    xpReasoning,
  });

  return NextResponse.json({ task: row });
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: builds clean (this route no longer needs any Supabase env vars).

- [ ] **Step 3: Commit**

```bash
git add app/api/tasks/create/route.ts
git commit -m "feat: back tasks/create route with local db"
```

---

### Task 8: Rewrite `app/api/tasks/complete`

**Files:**
- Modify: `app/api/tasks/complete/route.ts`

**Interfaces:**
- Consumes: `getDb` from `@/lib/db`; `completeTask` from `@/lib/tasks-store` (Task 3).

- [ ] **Step 1: Replace the route**

```typescript
// app/api/tasks/complete/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { completeTask } from '@/lib/tasks-store';

export async function POST(request: Request) {
  const { taskId } = await request.json();
  if (typeof taskId !== 'string' || taskId.length === 0) {
    return NextResponse.json({ error: 'taskId invalido' }, { status: 400 });
  }

  const db = getDb();
  try {
    const task = completeTask(db, taskId);
    return NextResponse.json({ ok: true, xpAwarded: task.xp_value ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error desconocido';
    const status = message.includes('no encontrada') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/tasks/complete/route.ts
git commit -m "feat: back tasks/complete route with local db"
```

---

### Task 9: Rewrite `app/api/redeem`

**Files:**
- Modify: `app/api/redeem/route.ts`

**Interfaces:**
- Consumes: `getDb` from `@/lib/db`; `listRewards`, `redeemIfSufficient` from `@/lib/rewards-store` (Task 4); `pickChestItem` from `@/lib/rewards` (unchanged, already tested).

- [ ] **Step 1: Replace the route**

```typescript
// app/api/redeem/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listRewards, redeemIfSufficient } from '@/lib/rewards-store';
import { pickChestItem } from '@/lib/rewards';

export async function POST(request: Request) {
  const { rewardId } = await request.json();
  if (typeof rewardId !== 'string' || rewardId.length === 0) {
    return NextResponse.json({ error: 'rewardId invalido' }, { status: 400 });
  }

  const db = getDb();
  const reward = listRewards(db).find((r) => r.id === rewardId);
  if (!reward) return NextResponse.json({ error: 'recompensa no encontrada' }, { status: 404 });

  let redeemedItem: { id?: string; name: string; rarity?: string } = { name: reward.name };

  if (reward.type === 'chest') {
    const chestItems = listRewards(db).filter((r) => r.type === 'chest_item');
    if (chestItems.length === 0) {
      return NextResponse.json({ error: 'no hay objetos definidos para este cofre' }, { status: 400 });
    }
    const picked = pickChestItem(
      chestItems.map((r) => ({ id: r.id, name: r.name, rarity: r.rarity as 'common' | 'rare' | 'epic' }))
    );
    redeemedItem = { id: picked.id, name: picked.name, rarity: picked.rarity };
  }

  const redeemed = redeemIfSufficient(db, rewardId);
  if (!redeemed) return NextResponse.json({ error: 'xp insuficiente' }, { status: 400 });

  return NextResponse.json({ redeemed: redeemedItem });
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/redeem/route.ts
git commit -m "feat: back redeem route with local db"
```

---

### Task 10: New `GET /api/state` route

**Files:**
- Create: `app/api/state/route.ts`

**Interfaces:**
- Consumes: `getDb` from `@/lib/db`; `getXpBalance` from `@/lib/settings-store`; `listTasks` from `@/lib/tasks-store`; `countRedemptions` from `@/lib/rewards-store`.
- Produces: `GET` returning `{ xpBalance: number, tasks: TaskRow[], redemptionCount: number }`.

- [ ] **Step 1: Write the route**

```typescript
// app/api/state/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getXpBalance } from '@/lib/settings-store';
import { listTasks } from '@/lib/tasks-store';
import { countRedemptions } from '@/lib/rewards-store';

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    xpBalance: getXpBalance(db),
    tasks: listTasks(db),
    redemptionCount: countRedemptions(db),
  });
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/state/route.ts
git commit -m "feat: add GET /api/state for the dashboard"
```

---

### Task 11: New `/api/rewards` route (list + create)

**Files:**
- Create: `app/api/rewards/route.ts`

**Interfaces:**
- Consumes: `getDb` from `@/lib/db`; `getXpBalance` from `@/lib/settings-store`; `listRewards`, `insertReward` from `@/lib/rewards-store`.
- Produces: `GET` returning `{ xpBalance: number, rewards: RewardRow[] }`; `POST` body `{ type, name, xpCost, rarity }` returning `{ reward: RewardRow }` or `{ error }`.

- [ ] **Step 1: Write the route**

```typescript
// app/api/rewards/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getXpBalance } from '@/lib/settings-store';
import { listRewards, insertReward } from '@/lib/rewards-store';

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    xpBalance: getXpBalance(db),
    rewards: listRewards(db),
  });
}

export async function POST(request: Request) {
  const { type, name, xpCost, rarity } = await request.json();

  if (!['shop', 'chest', 'chest_item'].includes(type)) {
    return NextResponse.json({ error: 'tipo invalido' }, { status: 400 });
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'nombre invalido' }, { status: 400 });
  }
  const cost = Number(xpCost);
  if (!Number.isFinite(cost) || !Number.isInteger(cost) || cost <= 0) {
    return NextResponse.json({ error: 'costo invalido' }, { status: 400 });
  }

  const db = getDb();
  const reward = insertReward(db, {
    type,
    name: name.trim(),
    xpCost: cost,
    rarity: type === 'chest_item' ? rarity : null,
  });

  return NextResponse.json({ reward });
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/rewards/route.ts
git commit -m "feat: add GET/POST /api/rewards"
```

---

### Task 12: New `/api/settings` route

**Files:**
- Create: `app/api/settings/route.ts`

**Interfaces:**
- Consumes: `getDb` from `@/lib/db`; `getDeepseekKey`, `setDeepseekKey` from `@/lib/settings-store`.
- Produces: `GET` returning `{ hasDeepseekKey: boolean }` (never echoes the key back to the client); `POST` body `{ deepseekKey: string }` returning `{ ok: true }`.

- [ ] **Step 1: Write the route**

```typescript
// app/api/settings/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getDeepseekKey, setDeepseekKey } from '@/lib/settings-store';

export async function GET() {
  const db = getDb();
  return NextResponse.json({ hasDeepseekKey: getDeepseekKey(db) !== null });
}

export async function POST(request: Request) {
  const { deepseekKey } = await request.json();
  if (typeof deepseekKey !== 'string' || deepseekKey.trim().length === 0) {
    return NextResponse.json({ error: 'clave invalida' }, { status: 400 });
  }

  setDeepseekKey(getDb(), deepseekKey.trim());
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/settings/route.ts
git commit -m "feat: add GET/POST /api/settings for the deepseek key"
```

---

### Task 13: Settings modal component

**Files:**
- Create: `components/SettingsModal.tsx`

**Interfaces:**
- Consumes: `IconHelp` (reused as a generic icon — no new icon needed) or none; follows the exact structural pattern of `components/HelpModal.tsx` (read that file first for the modal-backdrop/modal-dialog/close-button markup this must match).
- Produces: `<SettingsModal isOpen: boolean, onClose: () => void, onSaved: () => void>` — `onSaved` is called after a successful `POST /api/settings` so the caller can re-check `hasDeepseekKey`.

- [ ] **Step 1: Write the component**

```typescript
// components/SettingsModal.tsx
'use client';

import React, { useState } from 'react';
import { IconClose } from './Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function save() {
    if (!key.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deepseekKey: key.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setKey('');
      onSaved();
      onClose();
    } catch {
      setError('No se pudo guardar la clave.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Clave de DeepSeek</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
            aria-label="Cerrar"
          >
            <IconClose size={20} />
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Se usa para evaluar el XP de tus tareas. Se guarda solo en este equipo.
        </p>

        <div className="form-group">
          <label htmlFor="deepseek-key">Clave de API</label>
          <input
            id="deepseek-key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            onKeyDown={(e) => { if (e.key === 'Enter' && key.trim() && !saving) save(); }}
          />
        </div>

        {error && (
          <p style={{ color: '#b3452f', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>
        )}

        <button className="btn" onClick={save} disabled={saving || !key.trim()} style={{ width: '100%' }}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: builds clean (component isn't wired into a page yet — Task 14 does that — but it must at least typecheck standalone).

- [ ] **Step 3: Commit**

```bash
git add components/SettingsModal.tsx
git commit -m "feat: add settings modal for the deepseek key"
```

---

### Task 14: Rewire the dashboard (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `GET /api/state` (Task 10), `POST /api/settings`'s counterpart `GET /api/settings` (Task 12) for the "has a key yet" check, `SettingsModal` (Task 13).

- [ ] **Step 1: Remove auth, fetch from `/api/state`, drop "Salir", add Settings**

Read the current `app/page.tsx` in full first — this task only changes: (a) `loadDashboard`'s body, (b) removing `signOut`, (c) removing the "Salir" nav button, (d) adding a settings-modal trigger, (e) removing the `createBrowserClient`/`useRouter`/`supabase` plumbing that's no longer needed since there's no session to check.

Replace the imports and state at the top:

```typescript
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '@/components/Header';
import XpProgressBar from '@/components/XpProgressBar';
import Toast, { useToast } from '@/components/Toast';
import Confetti from '@/components/Confetti';
import AchievementsModal from '@/components/AchievementsModal';
import HelpModal from '@/components/HelpModal';
import SettingsModal from '@/components/SettingsModal';
import StreakBadge from '@/components/StreakBadge';
import MobileNav from '@/components/MobileNav';
import { soundFX } from '@/lib/sound';
import { calculateStreakFromDates } from '@/lib/streak';
import {
  IconDashboard,
  IconGift,
  IconTrophy,
  IconHelp,
  IconLightning,
  IconClock,
  IconPlus,
  IconSearch,
} from '@/components/Icons';
```

(Note: `IconLogout` import and everything Supabase-related is gone. `IconLightning`/`IconClock`/`IconPlus`/`IconSearch` — check whether the current file still imports these; keep whichever the existing JSX below actually uses, don't import unused icons.)

Replace `loadDashboard` and remove `signOut`:

```typescript
  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      const newXp = data.xpBalance ?? 0;

      if (
        previousXpBalanceRef.current !== null &&
        Math.floor(newXp / 100) > Math.floor(previousXpBalanceRef.current / 100)
      ) {
        soundFX.playLevelUp();
        showToast(`Subiste al nivel ${Math.floor(newXp / 100) + 1}`, 'success');
      }

      previousXpBalanceRef.current = newXp;
      setXpBalance(newXp);
      setTasks(data.tasks ?? []);
      setStreak(calculateStreakFromDates((data.tasks ?? []).map((task: Task) => task.completed_at)));
      setRedemptionCount(data.redemptionCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, [showToast]);
```

Remove the `signOut` function entirely, and remove the `<button className="nav-link" onClick={signOut}>Salir</button>` from the `<Header>` block. Add a `showSettings` state alongside the existing `showAchievements`/`showHelp` state, a `<SettingsModal isOpen={showSettings} onClose={...} onSaved={loadDashboard} />` next to the other modals, and a nav button that opens it (reuse `IconHelp`-style pattern, any reasonable icon already imported — e.g. `IconLightning` next to "Ayuda" is fine, it's the settings/config entry point).

Remove the `createBrowserClient`/`useRouter`/`supabase` state (the `const [supabase] = useState(...)`, `const router = useRouter()` lines) — nothing in this file needs them anymore, every data operation goes through `fetch()`.

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: builds clean, no unused-import errors, no references to `createBrowserClient`/`router`/`signOut` left.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all pass (this file has no direct unit tests — this step confirms the refactor didn't break `lib/` functions it imports).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "refactor: dashboard reads from /api/state, drops auth and sign-out"
```

---

### Task 15: Rewire the rewards page (`app/rewards/page.tsx`)

**Files:**
- Modify: `app/rewards/page.tsx`

**Interfaces:**
- Consumes: `GET /api/rewards` and `POST /api/rewards` (Task 11).

- [ ] **Step 1: Remove auth, fetch/post via `/api/rewards`**

Read the current `app/rewards/page.tsx` in full first. Replace `loadRewards`:

```typescript
  const loadRewards = useCallback(async () => {
    try {
      const res = await fetch('/api/rewards');
      const data = await res.json();
      setXpBalance(data.xpBalance ?? 0);
      setRewards(data.rewards ?? []);
      // streak still needs task completion dates — fetch /api/state for that piece
      const stateRes = await fetch('/api/state');
      const stateData = await stateRes.json();
      setStreak(calculateStreakFromDates((stateData.tasks ?? []).map((t: { completed_at: string | null }) => t.completed_at)));
    } finally {
      setLoading(false);
    }
  }, []);
```

Replace `createReward`:

```typescript
  async function createReward() {
    if (!name.trim()) return;
    soundFX.playClick();
    const res = await fetch('/api/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name, xpCost, rarity: type === 'chest_item' ? rarity : null }),
    });
    const data = await res.json();

    if (data.error) {
      showToast(`Error al crear recompensa: ${data.error}`, 'error');
      return;
    }

    showToast('Recompensa creada exitosamente', 'success');
    setName('');
    await loadRewards();
  }
```

Remove `createBrowserClient`/`useRouter`/`supabase` state and the `router.push('/login')` guard the same way as Task 14 — this page never redirects anywhere now.

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add app/rewards/page.tsx
git commit -m "refactor: rewards page reads/writes via /api/rewards, drops auth"
```

---

### Task 16: Delete the dead Supabase/auth code

**Files:**
- Delete: `app/login/page.tsx`, `app/auth/callback/route.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/route-auth.ts`, `supabase/` (entire directory), `app/api/cron/`, `app/api/sync-now/`, `.env.example`, `public/manifest.json`

- [ ] **Step 1: Verify nothing still references these before deleting**

Run:
```bash
grep -rn "lib/supabase\|@supabase/\|app/login\|auth/callback" app components lib --include="*.ts" --include="*.tsx"
```
Expected: no output (if anything shows up, Tasks 14/15 missed a reference — fix that first, don't delete out from under a live import).

- [ ] **Step 2: Delete the files**

```bash
git rm -r app/login app/auth lib/supabase supabase app/api/cron app/api/sync-now .env.example public/manifest.json
```

(If `app/api/cron`/`app/api/sync-now` are already-empty directories with nothing tracked in git, `git rm -r` will simply report nothing to remove there — that's fine, just delete them from disk with `rm -rf` in that case.)

- [ ] **Step 3: Verify the app still builds and tests pass**

Run: `npm run build && npm test`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove Supabase, auth, and PWA-manifest leftovers"
```

---

### Task 17: Electron packaging

**Files:**
- Modify: `next.config.js`, `app/layout.tsx`, `package.json`, `.gitignore`
- Create: `electron/main.js`

**Interfaces:**
- Produces: `npm run electron:dev` (local development), `npm run electron:build` (produces a portable Windows build via `electron-builder`).

- [ ] **Step 1: Remove `next-pwa`, add standalone output**

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
};
```

- [ ] **Step 2: Remove the manifest link from the layout**

In `app/layout.tsx`, delete the line:
```typescript
<link rel="manifest" href="/manifest.json" />
```
(the `<meta name="theme-color" .../>` line and the no-flash theme `<script>` stay — only the PWA manifest link goes.)

- [ ] **Step 3: Update dependencies and scripts**

```bash
npm uninstall @supabase/supabase-js @supabase/ssr next-pwa
npm install --save-dev electron@^32.0.0 electron-builder@^25.0.0 concurrently@^9.0.0 wait-on@^8.0.0 @electron/rebuild@^3.6.0
```

Edit `package.json`'s `scripts` and add a `main` field:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "electron:dev": "electron .",
    "electron:build": "next build && electron-builder --win portable"
  }
}
```

- [ ] **Step 4: Write the Electron main process**

```javascript
// electron/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
let activePort = null;

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No se pudo reservar un puerto de inicio')));
        return;
      }

      const port = address.port;
      server.close((closeError) => {
        if (closeError) reject(closeError);
        else resolve(port);
      });
    });
  });
}

function waitForServer(port, callback) {
  const attempt = () => {
    http
      .get({ hostname: '127.0.0.1', port, path: '/api/state' }, (response) => {
        response.resume();
        if (response.statusCode >= 200 && response.statusCode < 300) {
          callback();
          return;
        }
        setTimeout(attempt, 300);
      })
      .on('error', () => setTimeout(attempt, 300));
  };
  attempt();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(`http://localhost:${PORT}`);
}

app.whenReady().then(() => {
  process.env.DB_PATH = path.join(app.getPath('userData'), 'data.db');

  if (isDev) {
    // In dev, Electron owns the Next.js process so DB_PATH is set before `next dev` starts.
    const child = spawn('npm', ['run', 'dev'], {
      env: { ...process.env, DB_PATH: process.env.DB_PATH },
      stdio: 'inherit',
      shell: true,
    });
    app.on('before-quit', () => child.kill());
    waitForServer(activePort, createWindow);
  } else {
    // Packaged build: spawn the standalone Next.js server bundled alongside this app.
    const serverPath = path.join(process.resourcesPath, 'standalone', 'server.js');
    const child = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        HOSTNAME: '127.0.0.1',
        PORT: String(PORT),
        NODE_ENV: 'production',
      },
      stdio: 'inherit',
    });
    app.on('before-quit', () => child.kill());
    waitForServer(`http://127.0.0.1:${PORT}/api/state`, createWindow);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 5: Configure `electron-builder` to bundle the standalone build**

Add to `package.json`:

```json
{
  "build": {
    "appId": "com.local.sistema-de-recompensas",
    "productName": "Sistema de Recompensas",
    "files": ["electron/**/*"],
    "extraResources": [
      { "from": ".next/standalone", "to": "standalone" },
      { "from": ".next/static", "to": "standalone/.next/static" },
      { "from": "public", "to": "standalone/public" }
    ],
    "win": { "target": "portable" }
  }
}
```

- [ ] **Step 6: Update `.gitignore`**

```bash
echo "dist/" >> .gitignore
echo "out/" >> .gitignore
```

- [ ] **Step 7: Verify the dev flow launches**

Run: `npm run electron:dev`
Expected: an Electron window opens showing the dashboard within ~10 seconds, and `GET /api/state` returns 200 before the window is created. This is the first real integration point between Electron and the standalone-output Next.js server — expect this step to need iteration (port conflicts, `better-sqlite3` native-binding mismatches between system Node and Electron's bundled Node) more than any other step in this plan. If `better-sqlite3` throws a NODE_MODULE_VERSION mismatch when required from inside the packaged app, run `npx electron-rebuild` before `electron:build`.

- [ ] **Step 8: Commit**

```bash
git add next.config.js app/layout.tsx package.json package-lock.json .gitignore electron/main.js
git commit -m "feat: package the app as an Electron desktop build"
```

---

## Self-Review

**Spec coverage:** every section of `docs/superpowers/specs/2026-07-19-electron-local-migration-design.md` maps to a task — Architecture → Task 17, Data layer → Tasks 1-4, Auth removed → Tasks 14-16, DeepSeek key/settings → Tasks 12-13, New/changed API routes → Tasks 7-12, Packaging → Task 17, Testing → each task's own test step plus Task 4's atomic-redeem correctness test.

**Placeholder scan:** no "TBD"/"handle errors appropriately"/"similar to Task N" language — every step has real, complete code.

**Type consistency:** `TaskRow`/`RewardRow` field names and the `Db` type are defined once (Tasks 1, 3, 4) and reused identically by every later task (7-12) — checked against each other while writing this plan.

One known soft spot, called out in Task 17 Step 7 rather than glossed over: the exact `electron-builder`/`better-sqlite3`-native-rebuild interaction is the least-proven part of this plan (no prior art in this repo to follow), and should be expected to need hands-on iteration during execution rather than working first try.
