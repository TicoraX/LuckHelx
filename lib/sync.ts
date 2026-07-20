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
