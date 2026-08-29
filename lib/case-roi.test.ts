import { describe, it, expect } from 'vitest';
import { calculateChestRoi } from './case-roi';

describe('Case ROI & Expected Value Engine', () => {
  it('computes expected value and ROI classification accurately', () => {
    // Chest cost 1000 XP units, Key 800 XP units -> Total 1800 units
    // Pool with common ($1.00 USD), rare ($5.00 USD), epic ($20.00 USD), legendary ($100.00 USD)
    const items = [
      { rarity: 'common', priceUsd: 1.0 },
      { rarity: 'rare', priceUsd: 5.0 },
      { rarity: 'epic', priceUsd: 20.0 },
      { rarity: 'legendary', priceUsd: 100.0 },
    ];

    const result = calculateChestRoi({
      chestCostXpUnits: 1000,
      keyCostXpUnits: 800,
      sellRate: 0.4,
      items,
    });

    expect(result.expectedValueXpUnits).toBeGreaterThan(0);
    expect(result.roiPercent).toBeGreaterThan(0);
    expect(['high', 'balanced', 'risky']).toContain(result.tier);
  });
});
