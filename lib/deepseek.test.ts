import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateTask } from './deepseek';

describe('evaluateTask', () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
  });

  it('parses a valid DeepSeek response and returns clamped xp', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ xp: 30, reasoning: 'tarea de dificultad media' }) } }],
      }),
    }) as any;

    const result = await evaluateTask({ title: 'Lavar los platos', description: 'lavar toda la cocina' });

    expect(result).toEqual({ xp: 30, reasoning: 'tarea de dificultad media' });
  });

  it('clamps an out-of-range xp from the model', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ xp: 999999, reasoning: 'exagerado' }) } }],
      }),
    }) as any;

    const result = await evaluateTask({ title: 'x', description: 'y' });

    expect(result.xp).toBe(100);
  });

  it('falls back to MIN_XP when the model response is not valid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'no soy json' } }],
      }),
    }) as any;

    const result = await evaluateTask({ title: 'x', description: 'y' });

    expect(result.xp).toBe(5);
    expect(result.reasoning).toMatch(/no se pudo evaluar/i);
  });
});
