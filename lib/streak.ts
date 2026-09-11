const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDay(value: string | null | undefined, todayUtc: number): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const utcDay = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  if (utcDay > todayUtc) return null;
  return utcDay;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  freezeUsed: boolean;
  freezesRemaining: number;
  isActive: boolean;
}

export interface StreakStatsOptions {
  streakFreezesAvailable?: number;
  now?: Date;
  fallback?: number;
}

export function calculateStreakStats(
  dates: Array<string | null | undefined>,
  options: StreakStatsOptions = {}
): StreakStats {
  const { streakFreezesAvailable = 0, now = new Date(), fallback = 0 } = options;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const uniqueDays = Array.from(
    new Set(
      dates
        .map((value) => toUtcDay(value, todayUtc))
        .filter((value): value is number => value !== null)
    )
  ).sort((a, b) => b - a);

  if (uniqueDays.length === 0) {
    return {
      currentStreak: fallback,
      longestStreak: fallback,
      freezeUsed: false,
      freezesRemaining: streakFreezesAvailable,
      isActive: fallback > 0,
    };
  }

  // Calculate longest historical streak
  let longestStreak = 1;
  let runningStreak = 1;
  for (let i = 0; i < uniqueDays.length - 1; i++) {
    if (uniqueDays[i] - uniqueDays[i + 1] === MS_PER_DAY) {
      runningStreak++;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      runningStreak = 1;
    }
  }

  const mostRecentDay = uniqueDays[0];
  const daysElapsed = Math.floor((todayUtc - mostRecentDay) / MS_PER_DAY);

  let currentStreak = 0;
  let freezeUsed = false;
  let freezesRemaining = streakFreezesAvailable;
  let isActive = false;

  if (daysElapsed <= 1) {
    // Activity today or yesterday
    isActive = true;
    currentStreak = 1;
    let prev = mostRecentDay;
    for (const day of uniqueDays.slice(1)) {
      if (prev - day !== MS_PER_DAY) break;
      currentStreak++;
      prev = day;
    }
  } else if (daysElapsed === 2 && streakFreezesAvailable > 0) {
    // Missing only yesterday, streak freeze rescues it!
    freezeUsed = true;
    freezesRemaining -= 1;
    isActive = true;
    currentStreak = 1;
    let prev = mostRecentDay;
    for (const day of uniqueDays.slice(1)) {
      if (prev - day !== MS_PER_DAY) break;
      currentStreak++;
      prev = day;
    }
  } else {
    // Streak broken
    currentStreak = 0;
    isActive = false;
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    freezeUsed,
    freezesRemaining,
    isActive,
  };
}

export function calculateStreakFromDates(dates: Array<string | null | undefined>, fallback = 1): number {
  const stats = calculateStreakStats(dates, { fallback });
  return stats.currentStreak;
}