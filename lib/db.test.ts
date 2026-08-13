import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, initSchema } from './db';

describe('createTestDb', () => {
  it('creates every table the app relies on', () => {
    const db = createTestDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row: any) => row.name);
    expect(tables).toEqual([
      'chest_contents', 'item_sales', 'meta', 'redemptions', 'rewards', 'skin_prices', 'tasks',
    ]);
  });

  it('seeds a default xp_balance of 0', () => {
    const db = createTestDb();
    const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('xp_balance') as { value: string };
    expect(row.value).toBe('0');
  });

  it('rejects a task status outside evaluated/credited', () => {
    const db = createTestDb();
    expect(() => {
      db.prepare(
        `INSERT INTO tasks (id, title, status) VALUES ('t1', 'x', 'bogus')`
      ).run();
    }).toThrow();
  });

  it('rejects a redemption that points to a missing reward', () => {
    const db = createTestDb();
    expect(() => {
      db.prepare(
        `INSERT INTO redemptions (id, reward_id, xp_spent) VALUES ('r1', 'missing', 10)`
      ).run();
    }).toThrow();
  });

  it('rejects a chest_contents row pointing at a missing reward', () => {
    const db = createTestDb();
    expect(() => {
      db.prepare(
        `INSERT INTO chest_contents (chest_id, chest_item_id) VALUES ('missing-chest', 'missing-item')`
      ).run();
    }).toThrow();
  });

  it('allows legendary rarity on a reward row', () => {
    const db = createTestDb();
    expect(() => {
      db.prepare(
        `INSERT INTO rewards (id, type, name, xp_cost, rarity) VALUES ('k1', 'chest_item', 'Karambit', 1, 'legendary')`
      ).run();
    }).not.toThrow();
  });

  it('still rejects a rarity outside the known set', () => {
    const db = createTestDb();
    expect(() => {
      db.prepare(
        `INSERT INTO rewards (id, type, name, xp_cost, rarity) VALUES ('x1', 'chest_item', 'x', 1, 'mythic')`
      ).run();
    }).toThrow();
  });

  // Una base ya en uso no pasa por CREATE TABLE: si las columnas de snapshot no se
  // agregan por ALTER, /ledger explota con "no such column" en cada arranque.
  it('adds the snapshot columns to a redemptions table created before they existed', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE rewards (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL,
        xp_cost INTEGER NOT NULL, rarity TEXT, image TEXT, rarity_color TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE redemptions (
        id TEXT PRIMARY KEY,
        reward_id TEXT NOT NULL REFERENCES rewards(id),
        xp_spent INTEGER NOT NULL,
        redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO rewards (id, type, name, xp_cost) VALUES ('r1', 'shop', 'coffee', 10);
      INSERT INTO redemptions (id, reward_id, xp_spent) VALUES ('d1', 'r1', 10);
    `);

    initSchema(db);

    const row = db
      .prepare('SELECT reward_name_snapshot, won_item_name FROM redemptions WHERE id = ?')
      .get('d1') as { reward_name_snapshot: string; won_item_name: string | null };

    // El nombre viejo se rescata del reward vigente; el premio de ese canje se perdió.
    expect(row.reward_name_snapshot).toBe('coffee');
    expect(row.won_item_name).toBeNull();
  });

  it('is safe to run twice on the same database', () => {
    const db = createTestDb();
    expect(() => initSchema(db)).not.toThrow();
  });

  // Una base creada antes de que existiera `legendary` lleva el CHECK viejo grabado en la
  // tabla. Sin reconstruirla, sembrar un cuchillo revienta y el catálogo queda sin un solo
  // objeto legendary, que es exactamente lo que le pasó a la base de desarrollo.
  describe('rewards.rarity CHECK migration', () => {
    function dbWithOldCheck() {
      const db = new Database(':memory:');
      db.exec(`
        CREATE TABLE rewards (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('shop', 'chest', 'chest_item')),
          name TEXT NOT NULL,
          xp_cost INTEGER NOT NULL CHECK (xp_cost > 0),
          rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic')),
          image TEXT,
          rarity_color TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE chest_contents (
          chest_id TEXT NOT NULL REFERENCES rewards(id),
          chest_item_id TEXT NOT NULL REFERENCES rewards(id),
          PRIMARY KEY (chest_id, chest_item_id)
        );
        CREATE TABLE redemptions (
          id TEXT PRIMARY KEY,
          reward_id TEXT NOT NULL REFERENCES rewards(id),
          xp_spent INTEGER NOT NULL,
          redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO rewards (id, type, name, xp_cost, rarity) VALUES ('chest-1', 'chest', 'Case A', 50, NULL);
        INSERT INTO rewards (id, type, name, xp_cost, rarity) VALUES ('skin-1', 'chest_item', 'AK', 1, 'epic');
        INSERT INTO chest_contents (chest_id, chest_item_id) VALUES ('chest-1', 'skin-1');
        INSERT INTO redemptions (id, reward_id, xp_spent) VALUES ('d1', 'chest-1', 50);
      `);
      return db;
    }

    it('rejects legendary before the migration runs', () => {
      const db = dbWithOldCheck();
      expect(() => {
        db.prepare(`INSERT INTO rewards (id, type, name, xp_cost, rarity) VALUES ('k1', 'chest_item', 'Karambit', 1, 'legendary')`).run();
      }).toThrow(/CHECK/);
    });

    it('accepts legendary after the migration runs', () => {
      const db = dbWithOldCheck();
      initSchema(db);
      expect(() => {
        db.prepare(`INSERT INTO rewards (id, type, name, xp_cost, rarity) VALUES ('k1', 'chest_item', 'Karambit', 1, 'legendary')`).run();
      }).not.toThrow();
    });

    it('carries every row and reference through the table rebuild', () => {
      const db = dbWithOldCheck();
      initSchema(db);

      expect(db.prepare('SELECT COUNT(*) c FROM rewards').get()).toEqual({ c: 2 });
      expect(db.prepare('SELECT COUNT(*) c FROM chest_contents').get()).toEqual({ c: 1 });
      expect(db.prepare('SELECT COUNT(*) c FROM redemptions').get()).toEqual({ c: 1 });
      expect(db.pragma('foreign_key_check')).toEqual([]);
    });

    // `image` y `rarity_color` entraron en el mismo commit que `legendary`: toda base con
    // el CHECK viejo es también una base sin esas dos columnas. Copiarlas por nombre fijo
    // reventaba el SELECT de la reconstrucción, y con él initSchema, o sea que la app no
    // abría en exactamente la base que esta migración arregla.
    it('rebuilds a table that predates the image and rarity_color columns', () => {
      const db = new Database(':memory:');
      db.exec(`
        CREATE TABLE rewards (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('shop', 'chest', 'chest_item')),
          name TEXT NOT NULL,
          xp_cost INTEGER NOT NULL CHECK (xp_cost > 0),
          rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO rewards (id, type, name, xp_cost, rarity) VALUES ('r1', 'shop', 'coffee', 10, NULL);
      `);

      expect(() => initSchema(db)).not.toThrow();

      const row = db.prepare('SELECT * FROM rewards WHERE id = ?').get('r1') as Record<string, unknown>;
      expect(row.name).toBe('coffee');
      expect(row.image).toBeNull();
      expect(row.rarity_color).toBeNull();
      expect(() => {
        db.prepare(`INSERT INTO rewards (id, type, name, xp_cost, rarity) VALUES ('k1', 'chest_item', 'Karambit', 1, 'legendary')`).run();
      }).not.toThrow();
    });

    it('still enforces the other constraints after the rebuild', () => {
      const db = dbWithOldCheck();
      initSchema(db);
      expect(() => {
        db.prepare(`INSERT INTO rewards (id, type, name, xp_cost, rarity) VALUES ('x', 'chest_item', 'x', 0, 'common')`).run();
      }).toThrow();
      expect(() => {
        db.prepare(`INSERT INTO rewards (id, type, name, xp_cost, rarity) VALUES ('y', 'bogus', 'y', 1, 'common')`).run();
      }).toThrow();
    });
  });
});
