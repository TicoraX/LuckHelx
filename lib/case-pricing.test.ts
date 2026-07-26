import { describe, it, expect } from 'vitest';
import { usdToXp } from './case-pricing';

describe('usdToXp', () => {
  it('converts 1:1, rounding to the nearest integer', () => {
    expect(usdToXp(4.2)).toBe(4);
    expect(usdToXp(4.6)).toBe(5);
  });

  it('floors at 1 XP for very cheap cases', () => {
    expect(usdToXp(0.03)).toBe(1);
  });

  it('falls back to the default (50) when price is null', () => {
    expect(usdToXp(null)).toBe(50);
  });

  it('falls back to the default when price is undefined', () => {
    expect(usdToXp(undefined)).toBe(50);
  });

  it('falls back to the default when price is not a finite positive number', () => {
    expect(usdToXp(NaN)).toBe(50);
    expect(usdToXp(0)).toBe(1); // zero is a valid (very cheap) price, not a failure — floors to 1, doesn't fall back
    expect(usdToXp(-5)).toBe(50);
  });

  it('accepts a custom fallback', () => {
    expect(usdToXp(null, 75)).toBe(75);
  });
});
