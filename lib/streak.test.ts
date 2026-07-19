import { describe, it, expect } from 'vitest';
import { calculateStreakFromDates } from './streak';

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
});
