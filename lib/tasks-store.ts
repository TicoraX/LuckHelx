import { randomUUID } from 'crypto';
import type { Db } from './db';
import { incrementXpBalance } from './settings-store';

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
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO tasks (id, title, description, description_normalized, xp_value, xp_reasoning, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'evaluated', ?)`
  ).run(id, input.title, input.description, input.descriptionNormalized, input.xpValue, input.xpReasoning, createdAt);
  return getTaskById(db, id)!;
}

export function getTaskById(db: Db, id: string): TaskRow | null {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  return row ?? null;
}

export function completeTask(db: Db, id: string): TaskRow {
  const tx = db.transaction((taskId: string) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
    if (!task) throw new Error('tarea no encontrada');
    if (task.status === 'credited') throw new Error('esta tarea ya fue acreditada');

    const now = new Date().toISOString();
    const result = db
      .prepare(`UPDATE tasks SET status = 'credited', completed_at = ? WHERE id = ? AND status = 'evaluated'`)
      .run(now, taskId);

    if (result.changes === 0) throw new Error('esta tarea ya fue acreditada');

    incrementXpBalance(db, task.xp_value ?? 0);
  });
  tx(id);

  return getTaskById(db, id)!;
}
