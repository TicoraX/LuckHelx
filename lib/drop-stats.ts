export interface DropStatsRedemption {
  won_item_rarity: string | null;
  xp_spent: number;
}

export interface DropStatsResult {
  totalOpened: number;
  totalXpInvested: number;
  rarityCounts: {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  rarityPercentages: {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  luckRating: 'lucky' | 'average' | 'unlucky';
  luckScorePercent: number;
}

export function calculateDropStats(redemptions: DropStatsRedemption[]): DropStatsResult {
  const totalOpened = redemptions.length;
  let totalXpInvested = 0;

  const rarityCounts = {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };

  for (const r of redemptions) {
    totalXpInvested += r.xp_spent ?? 0;
    const rarity = (r.won_item_rarity ?? 'common').toLowerCase();
    if (rarity in rarityCounts) {
      rarityCounts[rarity as keyof typeof rarityCounts]++;
    } else {
      rarityCounts.common++;
    }
  }

  const rarityPercentages = {
    common: totalOpened > 0 ? Math.round((rarityCounts.common / totalOpened) * 100) : 0,
    rare: totalOpened > 0 ? Math.round((rarityCounts.rare / totalOpened) * 100) : 0,
    epic: totalOpened > 0 ? Math.round((rarityCounts.epic / totalOpened) * 100) : 0,
    legendary: totalOpened > 0 ? Math.round((rarityCounts.legendary / totalOpened) * 100) : 0,
  };

  // High-tier drops: rare, epic, legendary
  const highTierCount = rarityCounts.rare + rarityCounts.epic + rarityCounts.legendary;
  const luckScorePercent = totalOpened > 0 ? Math.round((highTierCount / totalOpened) * 100) : 20;

  // Expected baseline is ~20% (15.98% rare + 3.20% epic + 0.90% legendary)
  let luckRating: 'lucky' | 'average' | 'unlucky' = 'average';
  if (totalOpened >= 5) {
    if (luckScorePercent >= 28) {
      luckRating = 'lucky';
    } else if (luckScorePercent <= 12) {
      luckRating = 'unlucky';
    }
  }

  return {
    totalOpened,
    totalXpInvested,
    rarityCounts,
    rarityPercentages,
    luckRating,
    luckScorePercent,
  };
}
