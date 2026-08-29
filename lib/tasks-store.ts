import { randomUUID } from 'crypto';
import type { Db } from './db';
import { incrementXpBalance } from './settings-store';

export interface TaskRow {
  id: string;
  title: string;
  description: string;
  description_normalized: string;
  category?: string;
  recurrence?: 'none' | 'daily' | 'weekly';
  due_date?: string | null;
  ai_rationale?: string | null;
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
  input: {
    title: string;
    description: string;
    descriptionNormalized: string;
    category?: string;
    recurrence?: 'none' | 'daily' | 'weekly';
    dueDate?: string | null;
    aiRationale?: string | null;
    xpValue: number;
    xpReasoning: string;
  }
): TaskRow {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const category = input.category ?? 'general';
  const recurrence = input.recurrence ?? 'none';
  const dueDate = input.dueDate ?? null;
  const aiRationale = input.aiRationale ?? input.xpReasoning ?? null;

  db.prepare(
    `INSERT INTO tasks (id, title, description, description_normalized, category, recurrence, due_date, ai_rationale, xp_value, xp_reasoning, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'evaluated', ?)`
  ).run(
    id,
    input.title,
    input.description,
    input.descriptionNormalized,
    category,
    recurrence,
    dueDate,
    aiRationale,
    input.xpValue,
    input.xpReasoning,
    createdAt
  );
  return getTaskById(db, id)!;
}

export function resetRecurringTasks(db: Db, nowIso: string = new Date().toISOString()): number {
  const now = new Date(nowIso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), diff).getTime();

  const completedRecurring = db
    .prepare("SELECT * FROM tasks WHERE status = 'credited' AND recurrence IN ('daily', 'weekly')")
    .all() as TaskRow[];

  let resetCount = 0;

  db.transaction(() => {
    for (const task of completedRecurring) {
      if (!task.completed_at) continue;
      const completedTime = new Date(task.completed_at).getTime();

      let shouldReset = false;
      if (task.recurrence === 'daily' && completedTime < startOfToday) {
        shouldReset = true;
      } else if (task.recurrence === 'weekly' && completedTime < startOfThisWeek) {
        shouldReset = true;
      }

      if (shouldReset) {
        db.prepare("UPDATE tasks SET status = 'evaluated' WHERE id = ?").run(task.id);
        resetCount++;
      }
    }
  })();

  return resetCount;
}

export function getTaskById(db: Db, id: string): TaskRow | null {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  return row ?? null;
}

// Only pending (not yet credited) tasks can be deleted — a credited task already
// paid out XP, so removing it would need to also claw back that XP, which is a
// separate "undo" feature, not a "delete a mistake entry" one. Keep them apart.
export function deleteTask(db: Db, id: string): void {
  const task = getTaskById(db, id);
  if (!task) throw new Error('tarea no encontrada');
  if (task.status === 'credited') throw new Error('no se puede borrar una tarea ya acreditada');
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
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
