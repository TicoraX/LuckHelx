export interface HeatmapDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ActivityHeatmapData {
  days: HeatmapDay[];
  totalActiveDays: number;
  totalCompletedInRange: number;
}

function countToLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

export function generateActivityHeatmap(
  tasks: { completed_at: string | null }[],
  weeksCount = 16,
  now: Date = new Date()
): ActivityHeatmapData {
  const countsByDate = new Map<string, number>();

  for (const t of tasks) {
    if (!t.completed_at) continue;
    const dateKey = new Date(t.completed_at).toISOString().split('T')[0];
    countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
  }

  // Find end of current week (Sunday) or today in UTC
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = endDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const daysUntilEndOfWeek = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  endDate.setUTCDate(endDate.getUTCDate() + daysUntilEndOfWeek);

  const totalDays = weeksCount * 7;
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - (totalDays - 1));

  const days: HeatmapDay[] = [];
  let totalActiveDays = 0;
  let totalCompletedInRange = 0;

  const current = new Date(startDate);
  for (let i = 0; i < totalDays; i++) {
    const key = current.toISOString().split('T')[0];
    const count = countsByDate.get(key) ?? 0;
    const level = countToLevel(count);

    if (count > 0) {
      totalActiveDays++;
      totalCompletedInRange += count;
    }

    days.push({
      date: key,
      count,
      level,
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    days,
    totalActiveDays,
    totalCompletedInRange,
  };
}
