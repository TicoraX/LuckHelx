import { describe, it, expect } from 'vitest';
import {
  clampXpUnits,
  normalizeDescription,
  formatXp,
  parseXpInput,
  toXpUnits,
  MIN_XP_UNITS,
  MAX_XP_UNITS,
  XP_SCALE,
} from './xp';

describe('clampXpUnits', () => {
  it('converts the model\'s whole XP into units', () => {
    expect(clampXpUnits(42)).toBe(4200);
  });

  it('clamps above the maximum', () => {
    expect(clampXpUnits(999999)).toBe(MAX_XP_UNITS);
  });

  it('clamps below the minimum', () => {
    expect(clampXpUnits(-5)).toBe(MIN_XP_UNITS);
  });

  it('falls back to the minimum on a non-finite value', () => {
    expect(clampXpUnits(NaN)).toBe(MIN_XP_UNITS);
  });

  it('keeps the 5..100 XP range the prompt asks the model for', () => {
    expect(MIN_XP_UNITS).toBe(5 * XP_SCALE);
    expect(MAX_XP_UNITS).toBe(100 * XP_SCALE);
  });
});

describe('formatXp', () => {
  it('drops the decimals when the amount is whole XP', () => {
    expect(formatXp(1200)).toBe('12');
    expect(formatXp(0)).toBe('0');
  });

  // Lo que motivó toda la escala: la caja más barata del catálogo.
  it('shows the cents of a sub-XP amount', () => {
    expect(formatXp(30)).toBe('0,30');
    expect(formatXp(39)).toBe('0,39');
    expect(formatXp(5)).toBe('0,05');
  });

  it('groups thousands and keeps the sign', () => {
    expect(formatXp(1693700)).toBe('16.937');
    expect(formatXp(-250)).toBe('-2,50');
  });
});

describe('parseXpInput', () => {
  it('accepts a comma or a dot as the decimal separator', () => {
    expect(parseXpInput('12,5')).toBe(1250);
    expect(parseXpInput('12.5')).toBe(1250);
  });

  it('reads a whole number as whole XP', () => {
    expect(parseXpInput('8')).toBe(800);
  });

  // `Number('')` es 0 y `Number('abc')` es NaN: los dos pasaban como monto valido si esto
  // devolviera un numero en vez de null.
  it('rejects anything that is not a number', () => {
    expect(parseXpInput('')).toBeNull();
    expect(parseXpInput('   ')).toBeNull();
    expect(parseXpInput('abc')).toBeNull();
    expect(parseXpInput('-5')).toBeNull();
    expect(parseXpInput('1,2,3')).toBeNull();
  });

  it('round-trips through formatXp', () => {
    for (const text of ['0,39', '12', '2,50', '100']) {
      expect(formatXp(parseXpInput(text) as number)).toBe(text);
    }
  });
});

describe('toXpUnits', () => {
  it('always lands on an integer, so no cent survives as a float', () => {
    expect(Number.isInteger(toXpUnits(0.1 + 0.2))).toBe(true);
    expect(toXpUnits(0.1 + 0.2)).toBe(30);
  });
});

describe('normalizeDescription', () => {
  it('collapses whitespace and lowercases', () => {
    expect(normalizeDescription('  Lavar   EL Auto ')).toBe('lavar el auto');
  });
});
