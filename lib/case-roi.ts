import { toXpUnits } from './xp';

export const TIER_WEIGHTS = {
  common: 79.92,
  rare: 15.98,
  epic: 3.20,
  legendary: 0.90,
};

export interface ChestRoiInput {
  chestCostXpUnits: number;
  keyCostXpUnits: number;
  sellRate: number; // e.g. 0.4
  items: Array<{ rarity: string | null; priceUsd: number | null }>;
}

export interface ChestRoiResult {
  expectedValueXpUnits: number;
  roiPercent: number;
  tier: 'high' | 'balanced' | 'risky';
  tierLabel: string;
  tierColor: string;
}

export function calculateChestRoi(input: ChestRoiInput): ChestRoiResult {
  const totalCost = input.chestCostXpUnits + input.keyCostXpUnits;
  if (totalCost <= 0 || input.items.length === 0) {
    return {
      expectedValueXpUnits: 0,
      roiPercent: 0,
      tier: 'risky',
      tierLabel: 'Desconocido',
      tierColor: 'var(--text-muted)',
    };
  }

  // Average price per tier
  const tierAverages: Record<string, number> = {
    common: 0.5,
    rare: 2.0,
    epic: 15.0,
    legendary: 80.0,
  };

  const counts: Record<string, { totalUsd: number; count: number }> = {
    common: { totalUsd: 0, count: 0 },
    rare: { totalUsd: 0, count: 0 },
    epic: { totalUsd: 0, count: 0 },
    legendary: { totalUsd: 0, count: 0 },
  };

  for (const item of input.items) {
    const r = (item.rarity ?? 'common').toLowerCase();
    if (counts[r]) {
      counts[r].totalUsd += item.priceUsd ?? tierAverages[r];
      counts[r].count += 1;
    }
  }

  for (const key of Object.keys(counts)) {
    if (counts[key].count > 0) {
      tierAverages[key] = counts[key].totalUsd / counts[key].count;
    }
  }

  // CS2 official tier probability weights
  // common: 79.92%, rare: 15.98%, epic: 3.20%, legendary: 0.90%
  const totalWeight = TIER_WEIGHTS.common + TIER_WEIGHTS.rare + TIER_WEIGHTS.epic + TIER_WEIGHTS.legendary;
  const pCommon = TIER_WEIGHTS.common / totalWeight;
  const pRare = TIER_WEIGHTS.rare / totalWeight;
  const pEpic = TIER_WEIGHTS.epic / totalWeight;
  const pLegendary = TIER_WEIGHTS.legendary / totalWeight;

  const expectedUsd =
    pCommon * tierAverages.common +
    pRare * tierAverages.rare +
    pEpic * tierAverages.epic +
    pLegendary * tierAverages.legendary;

  // Convert USD to XP units applying sellRate
  // 1 USD = 1 XP (100 units) * sellRate
  const expectedValueXpUnits = Math.round(expectedUsd * input.sellRate * 100);
  const roiPercent = Math.round((expectedValueXpUnits / totalCost) * 100);

  let tier: 'high' | 'balanced' | 'risky' = 'risky';
  let tierLabel = 'Riesgo Alto';
  let tierColor = 'var(--rarity-common)';

  if (roiPercent >= 90) {
    tier = 'high';
    tierLabel = 'Alta Rentabilidad';
    tierColor = 'var(--accent-primary)';
  } else if (roiPercent >= 60) {
    tier = 'balanced';
    tierLabel = 'Equilibrada';
    tierColor = 'var(--accent-xp)';
  }

  return {
    expectedValueXpUnits,
    roiPercent,
    tier,
    tierLabel,
    tierColor,
  };
}
