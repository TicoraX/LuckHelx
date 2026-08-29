import { describe, it, expect } from 'vitest';
import { generateActivityHeatmap, getCategoryBreakdown, getCs2EconomyStats } from './analytics';

describe('Analytics & Heatmap Engine', () => {
  describe('generateActivityHeatmap', () => {
    it('generates heatmap cells for the requested number of weeks', () => {
      const now = new Date('2026-08-28T12:00:00.000Z');
      const tasks = [
        { completed_at: '2026-08-28T10:00:00.000Z' },
        { completed_at: '2026-08-28T11:00:00.000Z' },
        { completed_at: '2026-08-27T09:00:00.000Z' },
      ];

      const heatmap = generateActivityHeatmap(tasks, 4, now);
      expect(heatmap.days.length).toBe(28); // 4 weeks * 7 days

      const todayCell = heatmap.days.find((d) => d.date === '2026-08-28');
      expect(todayCell).toBeDefined();
      expect(todayCell?.count).toBe(2);
      expect(todayCell?.level).toBe(2); // 2 tasks -> level 2
    });

    it('assigns level 0 to days without tasks', () => {
      const now = new Date('2026-08-28T12:00:00.000Z');
      const heatmap = generateActivityHeatmap([], 2, now);
      expect(heatmap.days.every((d) => d.count === 0 && d.level === 0)).toBe(true);
    });
  });

  describe('getCategoryBreakdown', () => {
    it('calculates category counts and XP percentages accurately', () => {
      const tasks = [
        { category: 'trabajo', status: 'credited', xp_value: 6000 },
        { category: 'trabajo', status: 'credited', xp_value: 4000 },
        { category: 'salud', status: 'credited', xp_value: 5000 },
        { category: 'personal', status: 'evaluated', xp_value: 2000 }, // not credited, should be excluded
      ];

      const breakdown = getCategoryBreakdown(tasks);
      expect(breakdown.length).toBe(2);

      const trabajo = breakdown.find((b) => b.category === 'trabajo');
      expect(trabajo?.taskCount).toBe(2);
      expect(trabajo?.totalXp).toBe(10000);
      expect(trabajo?.percentage).toBe(67); // 10000 / 15000 = ~66.7% -> 67%

      const salud = breakdown.find((b) => b.category === 'salud');
      expect(salud?.taskCount).toBe(1);
      expect(salud?.totalXp).toBe(5000);
      expect(salud?.percentage).toBe(33);
    });
  });

  describe('getCs2EconomyStats', () => {
    it('computes total XP spent, recovered and inventory reference USD', () => {
      const redemptions = [
        { xp_spent: 1000, won_item_id: 'item1' },
        { xp_spent: 2000, won_item_id: 'item2' },
      ];
      const sales = [{ xp_credited: 800 }];
      const inventory = [
        { id: 'item1', count: 1, priceUsd: 15.5 },
        { id: 'item2', count: 1, priceUsd: null },
      ];

      const stats = getCs2EconomyStats(redemptions, sales, inventory);
      expect(stats.totalXpSpent).toBe(3000);
      expect(stats.totalXpRecovered).toBe(800);
      expect(stats.totalInventoryUsd).toBe(15.5);
    });
  });
});
