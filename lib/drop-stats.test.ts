import { describe, it, expect } from 'vitest';
import { calculateDropStats, type DropStatsRedemption } from './drop-stats';

describe('Drop Stats & Case ROI Tracker', () => {
  it('handles zero case openings gracefully', () => {
    const stats = calculateDropStats([]);
    expect(stats.totalOpened).toBe(0);
    expect(stats.totalXpInvested).toBe(0);
    expect(stats.rarityPercentages.common).toBe(0);
    expect(stats.luckRating).toBe('average');
  });

  it('computes exact tier distributions and classifies user luck accurately', () => {
    // User opened 10 cases: 6 common, 2 rare, 1 epic, 1 legendary
    // Expected Valve odds for rare or better: ~20% (15.98 + 3.20 + 0.90)
    // Here: 4 / 10 = 40% rare or better -> Lucky!
    const redemptions: DropStatsRedemption[] = [
      { won_item_rarity: 'common', xp_spent: 1000 },
      { won_item_rarity: 'common', xp_spent: 1000 },
      { won_item_rarity: 'common', xp_spent: 1000 },
      { won_item_rarity: 'common', xp_spent: 1000 },
      { won_item_rarity: 'common', xp_spent: 1000 },
      { won_item_rarity: 'common', xp_spent: 1000 },
      { won_item_rarity: 'rare', xp_spent: 1000 },
      { won_item_rarity: 'rare', xp_spent: 1000 },
      { won_item_rarity: 'epic', xp_spent: 1000 },
      { won_item_rarity: 'legendary', xp_spent: 1000 },
    ];

    const stats = calculateDropStats(redemptions);

    expect(stats.totalOpened).toBe(10);
    expect(stats.totalXpInvested).toBe(10000);
    expect(stats.rarityCounts.common).toBe(6);
    expect(stats.rarityCounts.rare).toBe(2);
    expect(stats.rarityCounts.epic).toBe(1);
    expect(stats.rarityCounts.legendary).toBe(1);

    expect(stats.rarityPercentages.common).toBe(60);
    expect(stats.rarityPercentages.rare).toBe(20);
    expect(stats.rarityPercentages.epic).toBe(10);
    expect(stats.rarityPercentages.legendary).toBe(10);

    expect(stats.luckRating).toBe('lucky');
    expect(stats.luckScorePercent).toBe(40);
  });
});
