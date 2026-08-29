import { XP_SCALE } from './xp';

export interface Cs2Rank {
  tier: number;
  rankName: string;
  minXp: number;
}

export const CS2_RANKS: Cs2Rank[] = [
  { tier: 1, rankName: 'Silver I', minXp: 0 },
  { tier: 2, rankName: 'Silver II', minXp: 100 },
  { tier: 3, rankName: 'Silver III', minXp: 250 },
  { tier: 4, rankName: 'Silver IV', minXp: 500 },
  { tier: 5, rankName: 'Silver Elite', minXp: 1000 },
  { tier: 6, rankName: 'Silver Elite Master', minXp: 2000 },
  { tier: 7, rankName: 'Gold Nova I', minXp: 3500 },
  { tier: 8, rankName: 'Gold Nova II', minXp: 5000 },
  { tier: 9, rankName: 'Gold Nova III', minXp: 7500 },
  { tier: 10, rankName: 'Gold Nova Master', minXp: 10000 },
  { tier: 11, rankName: 'Master Guardian I', minXp: 15000 },
  { tier: 12, rankName: 'Master Guardian II', minXp: 20000 },
  { tier: 13, rankName: 'Master Guardian Elite', minXp: 30000 },
  { tier: 14, rankName: 'Distinguished Master Guardian', minXp: 45000 },
  { tier: 15, rankName: 'Legendary Eagle', minXp: 60000 },
  { tier: 16, rankName: 'Legendary Eagle Master', minXp: 80000 },
  { tier: 17, rankName: 'Supreme Master First Class', minXp: 100000 },
  { tier: 18, rankName: 'The Global Elite', minXp: 150000 },
];

export interface UserRankProgress {
  tier: number;
  rankName: string;
  minXp: number;
  nextRankMinXp: number | null;
  currentXp: number;
  progressPercent: number;
}

export function getCs2Rank(xpUnits: number): UserRankProgress {
  const naturalXp = Math.max(0, Math.floor(xpUnits / XP_SCALE));

  let currentRankIndex = 0;
  for (let i = 0; i < CS2_RANKS.length; i++) {
    if (naturalXp >= CS2_RANKS[i].minXp) {
      currentRankIndex = i;
    } else {
      break;
    }
  }

  const currentRank = CS2_RANKS[currentRankIndex];
  const nextRank = currentRankIndex + 1 < CS2_RANKS.length ? CS2_RANKS[currentRankIndex + 1] : null;

  if (!nextRank) {
    return {
      tier: currentRank.tier,
      rankName: currentRank.rankName,
      minXp: currentRank.minXp,
      nextRankMinXp: null,
      currentXp: naturalXp,
      progressPercent: 100,
    };
  }

  const xpInTier = naturalXp - currentRank.minXp;
  const tierSpan = nextRank.minXp - currentRank.minXp;
  const progressPercent = Math.min(100, Math.max(0, Math.floor((xpInTier / tierSpan) * 100)));

  return {
    tier: currentRank.tier,
    rankName: currentRank.rankName,
    minXp: currentRank.minXp,
    nextRankMinXp: nextRank.minXp,
    currentXp: naturalXp,
    progressPercent,
  };
}
