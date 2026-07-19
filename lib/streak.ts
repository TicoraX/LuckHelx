const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDay(value: string): number | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const utcDay = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  const todayUtc = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());

  if (utcDay > todayUtc) return null;
  return utcDay;
}

export function calculateStreakFromDates(dates: Array<string | null | undefined>, fallback = 1): number {
  const uniqueDays = Array.from(
    new Set(
      dates
        .map((value) => (value ? toUtcDay(value) : null))
        .filter((value): value is number => value !== null),
    ),
  ).sort((a, b) => b - a);

  if (uniqueDays.length === 0) return fallback;

  const todayUtc = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const mostRecentDay = uniqueDays[0];
  const isStillActive = todayUtc - mostRecentDay <= MS_PER_DAY; // today or yesterday
  if (!isStillActive) return 0; // streak is broken — last activity was 2+ days ago

  let streak = 1;
  let previousDay = uniqueDays[0];

  for (const day of uniqueDays.slice(1)) {
    if (previousDay - day !== MS_PER_DAY) break;
    streak += 1;
    previousDay = day;
  }

  return streak;
}