import { XP_SCALE } from './xp';
import { calculateStreakFromDates } from './streak';

// ==========================================
// 1. Classic CS2 Ranks (Backwards-Compatible)
// ==========================================

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

// ==========================================
// 2. CS2 Premier Rating System (HU-06)
// ==========================================

export const PREMIER_MIN_RATING = 1000;
export const PREMIER_DECAY_GRACE_DAYS = 2;
export const PREMIER_DECAY_POINTS_PER_DAY = 250;
export const PREMIER_POINTS_PER_WEEKLY_TASK = 350;
export const PREMIER_POINTS_PER_DAILY_QUEST = 200;

export type PremierTierId = 'grey' | 'light_blue' | 'blue' | 'purple' | 'pink' | 'red' | 'gold';

export interface PremierTier {
  tier: number; // 1 to 7
  id: PremierTierId;
  name: string;
  minRating: number;
  maxRating: number;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
}

export const PREMIER_TIERS: readonly PremierTier[] = [
  {
    tier: 1,
    id: 'grey',
    name: 'Gris',
    minRating: 1000,
    maxRating: 4999,
    color: '#b0c3d9',
    bgColor: 'rgba(176, 195, 217, 0.12)',
    borderColor: '#4b5563',
    glowColor: 'rgba(176, 195, 217, 0.3)',
  },
  {
    tier: 2,
    id: 'light_blue',
    name: 'Celeste',
    minRating: 5000,
    maxRating: 9999,
    color: '#5e98d9',
    bgColor: 'rgba(94, 152, 217, 0.12)',
    borderColor: '#38bdf8',
    glowColor: 'rgba(94, 152, 217, 0.3)',
  },
  {
    tier: 3,
    id: 'blue',
    name: 'Azul',
    minRating: 10000,
    maxRating: 14999,
    color: '#4b69ff',
    bgColor: 'rgba(75, 105, 255, 0.14)',
    borderColor: '#4b69ff',
    glowColor: 'rgba(75, 105, 255, 0.35)',
  },
  {
    tier: 4,
    id: 'purple',
    name: 'Violeta',
    minRating: 15000,
    maxRating: 19999,
    color: '#8847ff',
    bgColor: 'rgba(136, 71, 255, 0.14)',
    borderColor: '#8847ff',
    glowColor: 'rgba(136, 71, 255, 0.35)',
  },
  {
    tier: 5,
    id: 'pink',
    name: 'Rosa',
    minRating: 20000,
    maxRating: 24999,
    color: '#d32ce6',
    bgColor: 'rgba(211, 44, 230, 0.14)',
    borderColor: '#d32ce6',
    glowColor: 'rgba(211, 44, 230, 0.35)',
  },
  {
    tier: 6,
    id: 'red',
    name: 'Rojo',
    minRating: 25000,
    maxRating: 29999,
    color: '#eb4b4b',
    bgColor: 'rgba(235, 75, 75, 0.14)',
    borderColor: '#eb4b4b',
    glowColor: 'rgba(235, 75, 75, 0.35)',
  },
  {
    tier: 7,
    id: 'gold',
    name: 'Dorado',
    minRating: 30000,
    maxRating: 35000,
    color: '#ffd700',
    bgColor: 'rgba(255, 215, 0, 0.16)',
    borderColor: '#ffd700',
    glowColor: 'rgba(255, 215, 0, 0.45)',
  },
] as const;

export function getPremierTier(rating: number): PremierTier {
  const safeRating = Number.isFinite(rating) ? Math.max(PREMIER_MIN_RATING, Math.floor(rating)) : PREMIER_MIN_RATING;

  for (let i = PREMIER_TIERS.length - 1; i >= 0; i--) {
    if (safeRating >= PREMIER_TIERS[i].minRating) {
      return PREMIER_TIERS[i];
    }
  }

  return PREMIER_TIERS[0];
}

/**
 * Multiplicador de racha: parte en 1.0x, suma 5% por día de racha activa, topeado en 2.0x (20 días).
 */
export function calculateStreakMultiplier(streakDays: number): number {
  const safeStreak = Number.isFinite(streakDays) && streakDays > 0 ? Math.floor(streakDays) : 0;
  return Number((1.0 + Math.min(1.0, safeStreak * 0.05)).toFixed(2));
}

/**
 * Mecánica de Rank Decay:
 * Inactividad prolongada (> 2 días sin actividad) reduce progresivamente el rating:
 * decay = (días_inactivos - 2) * 250 pts.
 * Nunca desciende por debajo de PREMIER_MIN_RATING (1,000 pts).
 */
export function calculatePremierDecay(
  rawRating: number,
  daysInactive: number
): { rating: number; decayAmount: number; daysDecayed: number } {
  const safeRaw = Number.isFinite(rawRating) ? Math.max(PREMIER_MIN_RATING, Math.floor(rawRating)) : PREMIER_MIN_RATING;
  const safeDays = Number.isFinite(daysInactive) ? Math.max(0, Math.floor(daysInactive)) : 0;

  if (safeDays <= PREMIER_DECAY_GRACE_DAYS) {
    return {
      rating: safeRaw,
      decayAmount: 0,
      daysDecayed: 0,
    };
  }

  const daysDecayed = safeDays - PREMIER_DECAY_GRACE_DAYS;
  const potentialDecay = daysDecayed * PREMIER_DECAY_POINTS_PER_DAY;
  const decayAmount = Math.min(potentialDecay, safeRaw - PREMIER_MIN_RATING);
  const rating = Math.max(PREMIER_MIN_RATING, safeRaw - decayAmount);

  return {
    rating,
    decayAmount,
    daysDecayed,
  };
}

export interface PremierRatingInput {
  totalXpUnits?: number;
  weeklyCompletedTasks: number;
  streakDays: number;
  dailyQuestsCompleted?: number;
  daysSinceLastActivity?: number;
  basePoints?: number;
}

export interface PremierRatingProgress {
  rating: number;
  rawRating: number;
  decayAmount: number;
  daysInactive: number;
  isDecayed: boolean;
  tier: PremierTier;
  nextTier: PremierTier | null;
  progressPercent: number;
  streakMultiplier: number;
  formattedRating: string;
}

export function formatPremierRating(rating: number): string {
  const safeRating = Number.isFinite(rating) ? Math.max(PREMIER_MIN_RATING, Math.floor(rating)) : PREMIER_MIN_RATING;
  return safeRating.toLocaleString('en-US');
}

export function calculatePremierRating(input: PremierRatingInput): PremierRatingProgress {
  const {
    totalXpUnits = 0,
    weeklyCompletedTasks = 0,
    streakDays = 0,
    dailyQuestsCompleted = 0,
    daysSinceLastActivity = 0,
    basePoints = PREMIER_MIN_RATING,
  } = input;

  const safeTasks = Math.max(0, Number.isFinite(weeklyCompletedTasks) ? Math.floor(weeklyCompletedTasks) : 0);
  const safeQuests = Math.max(0, Number.isFinite(dailyQuestsCompleted) ? Math.floor(dailyQuestsCompleted) : 0);
  const safeStreak = Math.max(0, Number.isFinite(streakDays) ? Math.floor(streakDays) : 0);
  const safeXpUnits = Math.max(0, Number.isFinite(totalXpUnits) ? Math.floor(totalXpUnits) : 0);
  const safeBase = Math.max(PREMIER_MIN_RATING, Number.isFinite(basePoints) ? Math.floor(basePoints) : PREMIER_MIN_RATING);

  // Bonus histórico: 1 punto de rating por cada 10 XP naturales
  const naturalXp = Math.floor(safeXpUnits / XP_SCALE);
  const xpBonusPoints = Math.floor(naturalXp / 10);

  // Hábitos semanales y consistencia
  const taskPoints = safeTasks * PREMIER_POINTS_PER_WEEKLY_TASK;
  const questPoints = safeQuests * PREMIER_POINTS_PER_DAILY_QUEST;
  const multiplier = calculateStreakMultiplier(safeStreak);

  // Puntuación bruta antes de decay
  const rawHabitPoints = Math.round((taskPoints + questPoints) * multiplier);
  const rawRating = safeBase + xpBonusPoints + rawHabitPoints;

  // Aplicación de degradación por inactividad (> 2 días)
  const decayResult = calculatePremierDecay(rawRating, daysSinceLastActivity);
  const finalRating = decayResult.rating;
  const currentTier = getPremierTier(finalRating);

  // Siguiente tier y porcentaje de progreso
  const tierIndex = PREMIER_TIERS.findIndex((t) => t.tier === currentTier.tier);
  const nextTier = tierIndex >= 0 && tierIndex + 1 < PREMIER_TIERS.length ? PREMIER_TIERS[tierIndex + 1] : null;

  let progressPercent = 100;
  if (nextTier) {
    const tierSpan = nextTier.minRating - currentTier.minRating;
    const ratingInTier = finalRating - currentTier.minRating;
    progressPercent = Math.min(100, Math.max(0, Math.floor((ratingInTier / tierSpan) * 100)));
  } else {
    // Tier Dorado (30,000+): barra hacia el hito mundial de 35,000 pts
    const goldSpan = 5000;
    const ratingInGold = finalRating - 30000;
    progressPercent = Math.min(100, Math.max(0, Math.floor((ratingInGold / goldSpan) * 100)));
  }

  return {
    rating: finalRating,
    rawRating,
    decayAmount: decayResult.decayAmount,
    daysInactive: Math.max(0, Math.floor(daysSinceLastActivity || 0)),
    isDecayed: decayResult.decayAmount > 0,
    tier: currentTier,
    nextTier,
    progressPercent,
    streakMultiplier: multiplier,
    formattedRating: formatPremierRating(finalRating),
  };
}

/**
 * Deduce las estadísticas de Premier Rating directamente del historial de tareas y XP.
 */
export function derivePremierStatsFromTasks(
  tasks: Array<{ completed_at: string | null; status: string }>,
  totalXpUnits: number = 0,
  now: Date = new Date(),
  dailyQuestsCompleted: number = 0
): PremierRatingProgress {
  const nowMs = now.getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

  const creditedTasks = tasks.filter((t) => t.status === 'credited' && Boolean(t.completed_at));

  // Tareas en ventana móvil de 7 días
  const weeklyCompletedTasks = creditedTasks.filter((t) => {
    const completedMs = new Date(t.completed_at!).getTime();
    return Number.isFinite(completedMs) && completedMs <= nowMs && nowMs - completedMs <= SEVEN_DAYS_MS;
  }).length;

  // Racha de días
  const streakDays = calculateStreakFromDates(
    creditedTasks.map((t) => t.completed_at),
    0
  );

  // Días de inactividad desde la tarea completada más reciente
  let daysSinceLastActivity = 0;
  if (creditedTasks.length > 0) {
    let latestMs = 0;
    for (const t of creditedTasks) {
      const ms = new Date(t.completed_at!).getTime();
      if (Number.isFinite(ms) && ms > latestMs && ms <= nowMs) {
        latestMs = ms;
      }
    }
    if (latestMs > 0) {
      daysSinceLastActivity = Math.floor((nowMs - latestMs) / ONE_DAY_MS);
    }
  }

  return calculatePremierRating({
    totalXpUnits,
    weeklyCompletedTasks,
    streakDays,
    dailyQuestsCompleted,
    daysSinceLastActivity,
  });
}
