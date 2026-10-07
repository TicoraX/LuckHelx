import { describe, expect, it } from 'vitest';
import { createTestDb } from './db';
import {
  getDeepseekKey,
  getOpeningSound,
  getSaleEconomy,
  getXpBalance,
  incrementXpBalance,
  OPENING_SOUND_DEFAULT,
  SALE_ECONOMY_DEFAULT,
  setDeepseekKey,
  setOpeningSound,
  setSaleEconomy,
} from './settings-store';

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
    expect(() => incrementXpBalance(db, 10.5)).toThrow(
      /incrementXpBalance requiere un monto entero/
    );
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
    expect(() => setOpeningSound(db, { offsetSeconds: -1, spinDurationMs: 6500 })).toThrow(
      /offset/
    );
    expect(() => setOpeningSound(db, { offsetSeconds: 5, spinDurationMs: 10 })).toThrow(/duracion/);
    expect(() => setOpeningSound(db, { offsetSeconds: 5, spinDurationMs: 999999 })).toThrow(
      /duracion/
    );
    expect(() => setOpeningSound(db, { offsetSeconds: NaN, spinDurationMs: 6500 })).toThrow(
      /offset/
    );
  });

  // Una base editada a mano o una migracion a medias no puede dejar el carrete sin girar.
  it('ignores an out-of-range value already sitting in the database', () => {
    const db = createTestDb();
    db.prepare("INSERT INTO meta (key, value) VALUES ('opening_spin_duration_ms', '0')").run();
    db.prepare("INSERT INTO meta (key, value) VALUES ('opening_sound_offset_s', 'abc')").run();
    expect(getOpeningSound(db)).toEqual(OPENING_SOUND_DEFAULT);
  });
});

describe('sale economy parity with USD', () => {
  it('defaults to 1.0 sellRate (1 USD = 1 XP) and 2.49 XP key cost', () => {
    const db = createTestDb();
    expect(SALE_ECONOMY_DEFAULT.sellRate).toBe(1.0);
    expect(getSaleEconomy(db).sellRate).toBe(1.0);
    expect(SALE_ECONOMY_DEFAULT.keyCostXpUnits).toBe(249);
    expect(getSaleEconomy(db).keyCostXpUnits).toBe(249);
  });

  it('persists and validates custom economy rates', () => {
    const db = createTestDb();
    setSaleEconomy(db, { sellRate: 0.8, keyCostXpUnits: 500 });
    expect(getSaleEconomy(db)).toEqual({ sellRate: 0.8, keyCostXpUnits: 500 });
  });

  it('rejects invalid sell rates', () => {
    const db = createTestDb();
    expect(() => setSaleEconomy(db, { sellRate: -0.1, keyCostXpUnits: 500 })).toThrow(
      /tasa de venta invalida/
    );
    expect(() => setSaleEconomy(db, { sellRate: 1.5, keyCostXpUnits: 500 })).toThrow(
      /tasa de venta invalida/
    );
  });
});
