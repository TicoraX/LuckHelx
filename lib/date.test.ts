import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { executeDailySpin, getDailySpinStatus } from './daily-spin';
import { formatShortDate, localDayKey } from './date';
import { createTestDb } from './db';
import { calculateStreakStats } from './streak';

describe('Date Formatting Utilities', () => {
  it('formats ISO dates to Spanish short date format (DD MMM)', () => {
    const formatted = formatShortDate('2026-08-28T14:30:00.000Z');
    expect(formatted).toMatch(/28\s+(ago|agosto)/i);
  });
});

// El dia de la app es el de la PC. En Bogota (UTC-5) las 20:00 del 28 ya son el 29 en UTC:
// con el corte en UTC se podia girar dos veces en la misma noche local.
describe('local day in America/Bogota', () => {
  const originalTz = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = 'America/Bogota';
  });
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  const evening = '2026-10-29T01:00:00.000Z'; // 28 de octubre, 20:00 en Bogota
  const nextMorning = '2026-10-29T13:00:00.000Z'; // 29 de octubre, 08:00 en Bogota

  it('keys the evening to the local calendar day', () => {
    expect(localDayKey(new Date(evening))).toBe('2026-10-28');
    expect(localDayKey(new Date(nextMorning))).toBe('2026-10-29');
  });

  it('allows one daily spin per local day, not per UTC day', () => {
    const db = createTestDb();
    executeDailySpin(db, '2026-10-28T14:00:00.000Z'); // 09:00 del 28
    expect(getDailySpinStatus(db, evening).canSpin).toBe(false);
    expect(getDailySpinStatus(db, nextMorning).canSpin).toBe(true);
  });

  it('counts a 20:00 task for that day in the streak', () => {
    // 27 a las 09:00 y 28 a las 20:00, locales: dos dias seguidos. En UTC eran el 27 y el
    // 29, con un hueco, y la racha caia a 1.
    const stats = calculateStreakStats(['2026-10-27T14:00:00.000Z', evening], {
      now: new Date('2026-10-29T02:00:00.000Z'),
    });
    expect(stats.currentStreak).toBe(2);
    expect(stats.isActive).toBe(true);
  });
});
