import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { getDailySpinStatus, executeDailySpin } from './daily-spin';
import { getXpBalance } from './settings-store';

describe('Daily Free Spin Engine', () => {
  it('allows spinning if not spun today and awards XP', () => {
    const db = createTestDb();
    const today = '2026-08-28T12:00:00.000Z';

    const statusBefore = getDailySpinStatus(db, today);
    expect(statusBefore.canSpin).toBe(true);

    const spinResult = executeDailySpin(db, today);
    expect(spinResult.xpAwarded).toBeGreaterThan(0);
    expect(getXpBalance(db)).toBe(spinResult.xpAwarded);

    const statusAfter = getDailySpinStatus(db, today);
    expect(statusAfter.canSpin).toBe(false);

    // Second spin on same day must fail
    expect(() => executeDailySpin(db, today)).toThrow(/ya utilizaste tu giro diario/);
  });
});
