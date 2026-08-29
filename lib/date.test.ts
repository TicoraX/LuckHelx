import { describe, it, expect } from 'vitest';
import { formatShortDate, formatRelativeTime } from './date';

describe('Date Formatting Utilities', () => {
  it('formats ISO dates to Spanish short date format (DD MMM)', () => {
    const formatted = formatShortDate('2026-08-28T14:30:00.000Z');
    expect(formatted).toMatch(/28\s+(ago|agosto)/i);
  });

  it('handles relative time calculations', () => {
    const now = new Date('2026-08-28T12:00:00.000Z');
    const past = '2026-08-28T10:00:00.000Z';
    expect(formatRelativeTime(past, now)).toBe('hace 2h');
  });
});
