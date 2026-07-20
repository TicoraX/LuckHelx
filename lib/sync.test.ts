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

  it('skips cached failure results and retries DeepSeek', async () => {
    const db = createTestDb();
    insertTask(db, {
      title: 'Fallida',
      description: 'lavar platos',
      descriptionNormalized: 'lavar platos',
      xpValue: 5,
      xpReasoning: 'no se pudo evaluar: la API de DeepSeek respondio con error',
    });
    vi.spyOn(deepseek, 'evaluateTask').mockResolvedValue({ xp: 44, reasoning: 'reintento' });

    const result = await evaluateAndCacheXp(db, 'key', { title: 'Lavar platos', description: 'lavar platos' });

    expect(result).toEqual({ xpValue: 44, xpReasoning: 'reintento', normalized: 'lavar platos' });
    expect(deepseek.evaluateTask).toHaveBeenCalledTimes(1);
  });
});
