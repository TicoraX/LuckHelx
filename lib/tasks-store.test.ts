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
    expect(rows[0].status).toBe('evaluated');
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

  it('getTaskById returns null for a missing id', () => {
    const db = createTestDb();
    expect(getTaskById(db, 'nope')).toBeNull();
  });
});
