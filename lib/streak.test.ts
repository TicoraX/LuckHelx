import { describe, it, expect } from 'vitest';
import { calculateStreakFromDates, calculateStreakStats } from './streak';

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

describe('calculateStreakFromDates', () => {
  it('counts consecutive days ending today', () => {
    const dates = [daysAgoIso(0), daysAgoIso(1), daysAgoIso(2)];
    expect(calculateStreakFromDates(dates)).toBe(3);
  });

  it('returns 0 when the last activity was 2+ days ago (broken streak)', () => {
    const dates = [daysAgoIso(5), daysAgoIso(6), daysAgoIso(7)];
    expect(calculateStreakFromDates(dates)).toBe(0);
  });

  it('still counts as active if the last activity was yesterday', () => {
    const dates = [daysAgoIso(1), daysAgoIso(2)];
    expect(calculateStreakFromDates(dates)).toBe(2);
  });

  it('dedupes multiple completions on the same day', () => {
    const dates = [daysAgoIso(0), daysAgoIso(0), daysAgoIso(1)];
    expect(calculateStreakFromDates(dates)).toBe(2);
  });

  it('returns the fallback when there are no valid dates', () => {
    expect(calculateStreakFromDates([null, undefined])).toBe(1);
    expect(calculateStreakFromDates([], 0)).toBe(0);
  });

  describe('calculateStreakStats', () => {
    it('computes currentStreak, longestStreak, and preserves streak with freeze when missing 1 day', () => {
      // Activity: 3 days ago, 2 days ago, gap yesterday (1 day ago), but freeze available
      const dates = [daysAgoIso(2), daysAgoIso(3), daysAgoIso(4)];

      // Without freeze: broken streak (last activity 2 days ago)
      const noFreeze = calculateStreakStats(dates, { streakFreezesAvailable: 0 });
      expect(noFreeze.currentStreak).toBe(0);
      expect(noFreeze.longestStreak).toBe(3);
      expect(noFreeze.freezeUsed).toBe(false);

      // With freeze available: preserves currentStreak 3, consumes 1 freeze
      const withFreeze = calculateStreakStats(dates, { streakFreezesAvailable: 1 });
      expect(withFreeze.currentStreak).toBe(3);
      expect(withFreeze.longestStreak).toBe(3);
      expect(withFreeze.freezeUsed).toBe(true);
      expect(withFreeze.freezesRemaining).toBe(0);
    });

    it('accurately tracks longest historical streak across separated periods', () => {
      const dates = [
        daysAgoIso(0),
        daysAgoIso(1),
        daysAgoIso(10),
        daysAgoIso(11),
        daysAgoIso(12),
        daysAgoIso(13),
        daysAgoIso(14),
      ];
      const stats = calculateStreakStats(dates);

      expect(stats.currentStreak).toBe(2);
      expect(stats.longestStreak).toBe(5);
      expect(stats.isActive).toBe(true);
    });
  });
});
