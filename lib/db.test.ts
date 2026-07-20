import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';

describe('createTestDb', () => {
  it('creates all four tables', () => {
    const db = createTestDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row: any) => row.name);
    expect(tables).toEqual(['meta', 'redemptions', 'rewards', 'tasks']);
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
});
