import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { getXpBalance, incrementXpBalance, getDeepseekKey, setDeepseekKey, getOpeningSound, setOpeningSound, OPENING_SOUND_DEFAULT } from './settings-store';

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

  it('rejects debiting balance below zero and leaves balance intact', () => {
    const db = createTestDb();
    incrementXpBalance(db, 50);
    expect(() => incrementXpBalance(db, -60)).toThrow(/Saldo de XP insuficiente/);
    expect(getXpBalance(db)).toBe(50);
  });

  it('rejects non-integer amount in incrementXpBalance', () => {
    const db = createTestDb();
    expect(() => incrementXpBalance(db, 10.5)).toThrow(/incrementXpBalance requiere un monto entero/);
  });

  it('has no deepseek key by default, then stores one', () => {
    const db = createTestDb();
    expect(getDeepseekKey(db)).toBeNull();
    setDeepseekKey(db, 'sk-test-123');
    expect(getDeepseekKey(db)).toBe('sk-test-123');
  });
});

describe('opening sound calibration', () => {
  it('falls back to the defaults when nothing was ever saved', () => {
    const db = createTestDb();
    expect(getOpeningSound(db)).toEqual(OPENING_SOUND_DEFAULT);
  });

  it('round-trips a saved calibration', () => {
    const db = createTestDb();
    setOpeningSound(db, { offsetSeconds: 3.5, spinDurationMs: 7200 });
    expect(getOpeningSound(db)).toEqual({ offsetSeconds: 3.5, spinDurationMs: 7200 });
  });

  it('rejects values that would break the reel', () => {
    const db = createTestDb();
    expect(() => setOpeningSound(db, { offsetSeconds: -1, spinDurationMs: 6500 })).toThrow(/offset/);
    expect(() => setOpeningSound(db, { offsetSeconds: 5, spinDurationMs: 10 })).toThrow(/duracion/);
    expect(() => setOpeningSound(db, { offsetSeconds: 5, spinDurationMs: 999999 })).toThrow(/duracion/);
    expect(() => setOpeningSound(db, { offsetSeconds: NaN, spinDurationMs: 6500 })).toThrow(/offset/);
  });

  // Una base editada a mano o una migracion a medias no puede dejar el carrete sin girar.
  it('ignores an out-of-range value already sitting in the database', () => {
    const db = createTestDb();
    db.prepare("INSERT INTO meta (key, value) VALUES ('opening_spin_duration_ms', '0')").run();
    db.prepare("INSERT INTO meta (key, value) VALUES ('opening_sound_offset_s', 'abc')").run();
    expect(getOpeningSound(db)).toEqual(OPENING_SOUND_DEFAULT);
  });
});
