import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';

describe('createTestDb', () => {
  it('creates all five tables', () => {
    const db = createTestDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row: any) => row.name);
    expect(tables).toEqual(['chest_contents', 'meta', 'redemptions', 'rewards', 'tasks']);
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
});
