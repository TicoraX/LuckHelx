import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { getXpBalance, incrementXpBalance, getDeepseekKey, setDeepseekKey } from './settings-store';

describe('settings-store', () => {
  it('starts at 0 xp', () => {
    const db = createTestDb();
    expect(getXpBalance(db)).toBe(0);
  });

  it('increments and persists the balance', () => {
    const db = createTestDb();
    expect(incrementXpBalance(db, 40)).toBe(40);
    expect(incrementXpBalance(db, -15)).toBe(25);
    expect(getXpBalance(db)).toBe(25);
  });

  it('has no deepseek key by default, then stores one', () => {
    const db = createTestDb();
    expect(getDeepseekKey(db)).toBeNull();
    setDeepseekKey(db, 'sk-test-123');
    expect(getDeepseekKey(db)).toBe('sk-test-123');
  });
});
