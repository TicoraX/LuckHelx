import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { initSchema } from './db';
import { getXpBalance } from './settings-store';
import { listTasks, findCachedXp, insertTask, getTaskById, completeTask } from './tasks-store';

function createSharedDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estiri-tasks-'));
  const filePath = path.join(dir, 'data.db');
  const db1 = new Database(filePath);
  const db2 = new Database(filePath);
  initSchema(db1);
  initSchema(db2);

  return {
    db1,
    db2,
    cleanup: () => {
      db1.close();
      db2.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe('tasks-store', () => {
  it('inserts a task and lists it back, newest first', () => {
    const db = createTestDb();
    insertTask(db, { title: 'a', description: '', descriptionNormalized: 'a', xpValue: 10, xpReasoning: 'r' });
    insertTask(db, { title: 'b', description: '', descriptionNormalized: 'b', xpValue: 20, xpReasoning: 'r' });
    const rows = listTasks(db);
    expect(rows.map((r) => r.title)).toEqual(['b', 'a']);
    expect(rows[0].status).toBe('evaluated');
  });

  it('breaks ties in newest-first order with rowid descending', () => {
    const db = createTestDb();
    db.prepare(
      `INSERT INTO tasks (id, title, description, description_normalized, xp_value, xp_reasoning, status, created_at)
       VALUES ('t1', 'a', '', 'a', 10, 'r', 'evaluated', '2026-07-19T00:00:00.000Z')`
    ).run();
    db.prepare(
      `INSERT INTO tasks (id, title, description, description_normalized, xp_value, xp_reasoning, status, created_at)
       VALUES ('t2', 'b', '', 'b', 10, 'r', 'evaluated', '2026-07-19T00:00:00.000Z')`
    ).run();

    expect(listTasks(db).map((r) => r.id)).toEqual(['t2', 't1']);
  });

  it('finds a cached xp value by normalized description, ignoring unrelated tasks', () => {
    const db = createTestDb();
    insertTask(db, { title: 'x', description: '', descriptionNormalized: 'lavar platos', xpValue: 15, xpReasoning: 'ya evaluado' });
    expect(findCachedXp(db, 'lavar platos')).toEqual({ xp_value: 15, xp_reasoning: 'ya evaluado' });
    expect(findCachedXp(db, 'algo distinto')).toBeNull();
  });

  it('completing a task credits it and awards its xp exactly once', () => {
    const db = createTestDb();
    const task = insertTask(db, { title: 'a', description: '', descriptionNormalized: 'a', xpValue: 30, xpReasoning: 'r' });
    const credited = completeTask(db, task.id);
    expect(credited.status).toBe('credited');
    expect(credited.completed_at).not.toBeNull();
    expect(getXpBalance(db)).toBe(30);
    expect(() => completeTask(db, task.id)).toThrow(/ya fue acreditada/);
    expect(getXpBalance(db)).toBe(30); // unchanged by the rejected second call
  });

  it('throws when completing a task that does not exist', () => {
    const db = createTestDb();
    expect(() => completeTask(db, 'nope')).toThrow(/no encontrada/);
  });

  it('rejects a second instance completing the same task', () => {
    const { db1, db2, cleanup } = createSharedDb();
    try {
      const task = insertTask(db1, { title: 'a', description: '', descriptionNormalized: 'a', xpValue: 30, xpReasoning: 'r' });

      const first = completeTask(db1, task.id);
      expect(first.status).toBe('credited');
      expect(getXpBalance(db1)).toBe(30);

      expect(() => completeTask(db2, task.id)).toThrow(/ya fue acreditada/);
      expect(getXpBalance(db2)).toBe(30);
    } finally {
      cleanup();
    }
  });

  it('getTaskById returns null for a missing id', () => {
    const db = createTestDb();
    expect(getTaskById(db, 'nope')).toBeNull();
  });
});
