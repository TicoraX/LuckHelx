import { describe, it, expect } from 'vitest';
import { formatShortDate } from './date';

describe('Date Formatting Utilities', () => {
  it('formats ISO dates to Spanish short date format (DD MMM)', () => {
    const formatted = formatShortDate('2026-08-28T14:30:00.000Z');
    expect(formatted).toMatch(/28\s+(ago|agosto)/i);
  });
});
