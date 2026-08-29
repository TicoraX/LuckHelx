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

export interface CategoryBreakdown {
  category: string;
  taskCount: number;
  totalXp: number;
  percentage: number;
}

export function getCategoryBreakdown(
  tasks: { category?: string; status: string; xp_value: number | null }[]
): CategoryBreakdown[] {
  const creditedTasks = tasks.filter((t) => t.status === 'credited');
  const totalsByCategory = new Map<string, { count: number; xp: number }>();
  let grandTotalXp = 0;

  for (const t of creditedTasks) {
    const cat = (t.category ?? 'general').toLowerCase();
    const xp = t.xp_value ?? 0;
    const prev = totalsByCategory.get(cat) ?? { count: 0, xp: 0 };
    totalsByCategory.set(cat, {
      count: prev.count + 1,
      xp: prev.xp + xp,
    });
    grandTotalXp += xp;
  }

  const result: CategoryBreakdown[] = [];
  for (const [category, val] of totalsByCategory.entries()) {
    const percentage = grandTotalXp > 0 ? Math.round((val.xp / grandTotalXp) * 100) : 0;
    result.push({
      category,
      taskCount: val.count,
      totalXp: val.xp,
      percentage,
    });
  }

  return result.sort((a, b) => b.totalXp - a.totalXp);
}

export interface Cs2EconomyStats {
  totalXpSpent: number;
  totalXpRecovered: number;
  totalInventoryUsd: number;
}

export function getCs2EconomyStats(
  redemptions: { xp_spent: number; won_item_id: string | null }[],
  sales: { xp_credited: number }[],
  inventory: { id: string; count: number; priceUsd: number | null }[]
): Cs2EconomyStats {
  const totalXpSpent = redemptions.reduce((acc, curr) => acc + (curr.xp_spent ?? 0), 0);
  const totalXpRecovered = sales.reduce((acc, curr) => acc + (curr.xp_credited ?? 0), 0);

  const totalInventoryUsd = inventory.reduce((acc, curr) => {
    if (typeof curr.priceUsd === 'number') {
      return acc + curr.priceUsd * (curr.count ?? 1);
    }
    return acc;
  }, 0);

  return {
    totalXpSpent,
    totalXpRecovered,
    totalInventoryUsd: Math.round(totalInventoryUsd * 100) / 100,
  };
}
