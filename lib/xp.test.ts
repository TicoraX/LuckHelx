import { describe, it, expect } from 'vitest';
import { clampXp, normalizeDescription, MIN_XP, MAX_XP } from './xp';

describe('clampXp', () => {
  it('passes through values inside the range', () => {
    expect(clampXp(42)).toBe(42);
  });

  it('clamps values above MAX_XP', () => {
    expect(clampXp(999999)).toBe(MAX_XP);
  });

  it('clamps values below MIN_XP', () => {
    expect(clampXp(-5)).toBe(MIN_XP);
  });

  it('clamps non-finite values to MIN_XP', () => {
    expect(clampXp(NaN)).toBe(MIN_XP);
  });
});

describe('normalizeDescription', () => {
  it('lowercases and trims', () => {
    expect(normalizeDescription('  Lavar Los Platos  ')).toBe('lavar los platos');
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeDescription('lavar   los    platos')).toBe('lavar los platos');
  });
});
