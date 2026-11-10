import { describe, expect, it } from 'vitest';
import {
  calculateTradeUpFloat,
  formatFloat,
  getSkinFloatRange,
  getWearInfo,
  rollFloatForSkin,
  rollSkinFloat,
} from './cs2-float';

describe('CS2 Float & Wear System (lib/cs2-float.ts)', () => {
  it('identifies standard CS2 wear tiers correctly', () => {
    expect(getWearInfo(0.01)?.tier).toBe('FN');
    expect(getWearInfo(0.0699)?.tier).toBe('FN');
    expect(getWearInfo(0.07)?.tier).toBe('MW');
    expect(getWearInfo(0.1499)?.tier).toBe('MW');
    expect(getWearInfo(0.15)?.tier).toBe('FT');
    expect(getWearInfo(0.3799)?.tier).toBe('FT');
    expect(getWearInfo(0.38)?.tier).toBe('WW');
    expect(getWearInfo(0.4499)?.tier).toBe('WW');
    expect(getWearInfo(0.45)?.tier).toBe('BS');
    expect(getWearInfo(0.99)?.tier).toBe('BS');
    expect(getWearInfo(1.0)?.tier).toBe('BS');
  });

  it('handles null, undefined, NaN, and out of bounds values gracefully', () => {
    expect(getWearInfo(null)).toBeNull();
    expect(getWearInfo(undefined)).toBeNull();
    expect(getWearInfo(Number.NaN)).toBeNull();
    expect(getWearInfo(-0.05)).toBeNull();
    expect(getWearInfo(1.05)).toBeNull();
  });

  it('provides complete wear metadata (names in Spanish and English)', () => {
    const fn = getWearInfo(0.02);
    expect(fn).not.toBeNull();
    expect(fn?.shortName).toBe('FN');
    expect(fn?.name).toBe('Recién Fabricado');
    expect(fn?.nameEn).toBe('Factory New');
    expect(fn?.color).toBe('#10b981');

    const bs = getWearInfo(0.8);
    expect(bs?.name).toBe('Deplorable');
    expect(bs?.nameEn).toBe('Battle-Scarred');
  });

  it('formats float with specified decimals', () => {
    expect(formatFloat(0.034185)).toBe('0.0342');
    expect(formatFloat(0.034185, 2)).toBe('0.03');
    expect(formatFloat(0.034185, 6)).toBe('0.034185');
    expect(formatFloat(null)).toBe('');
    expect(formatFloat(undefined)).toBe('');
  });

  it('rolls float uniformly between min and max', () => {
    // Deterministic mock RNG: returns 0, 0.5, 1
    expect(rollSkinFloat(0.06, 0.8, () => 0)).toBe(0.06);
    expect(rollSkinFloat(0.06, 0.8, () => 1)).toBe(0.8);
    expect(rollSkinFloat(0.06, 0.8, () => 0.5)).toBe(0.43); // 0.06 + 0.5 * 0.74 = 0.43
  });

  it('returns null when min or max float are null (vanilla skins)', () => {
    expect(rollSkinFloat(null, null)).toBeNull();
    expect(rollSkinFloat(undefined, undefined)).toBeNull();
    expect(rollSkinFloat(null, 0.8)).toBeNull();
  });

  it('calculates trade up float using official Valve formula', () => {
    const inputs = Array.from({ length: 10 }, () => ({
      float: 0.1,
      minFloat: 0.0,
      maxFloat: 1.0,
    }));
    const result = calculateTradeUpFloat(inputs, 0.0, 1.0);
    expect(result).toBe(0.1);
  });

  it('correctly maps trade up float to target min and max range', () => {
    const inputs = [{ float: 0.5, minFloat: 0.0, maxFloat: 1.0 }];
    const result = calculateTradeUpFloat(inputs, 0.06, 0.8);
    expect(result).toBe(0.43);
  });

  it('returns null for trade up when inputs have no valid floats', () => {
    expect(calculateTradeUpFloat([])).toBeNull();
    expect(calculateTradeUpFloat([{ float: Number.NaN }])).toBeNull();
  });

  it('looks up exact float ranges for weapon skins and handles vanilla knives', () => {
    const redline = getSkinFloatRange('AK-47 | Redline');
    expect(redline).not.toBeNull();
    expect(redline?.minFloat).toBe(0.1);
    expect(redline?.maxFloat).toBe(0.7);

    const fadeWithStar = getSkinFloatRange('★ Karambit | Fade');
    const fadeWithoutStar = getSkinFloatRange('Karambit | Fade');
    expect(fadeWithStar).not.toBeNull();
    expect(fadeWithoutStar).toEqual(fadeWithStar);

    expect(getSkinFloatRange('★ Karambit')).toBeNull();
    expect(getSkinFloatRange('Sticker | Navi')).toBeNull();
  });

  it('rolls float for a known skin within its official range', () => {
    const rolled = rollFloatForSkin('AK-47 | Redline', () => 0.5);
    expect(rolled).not.toBeNull();
    expect(rolled).toBe(0.4);
    expect(getWearInfo(rolled)?.tier).toBe('WW');

    expect(rollFloatForSkin('★ Karambit')).toBeNull();
  });
});
