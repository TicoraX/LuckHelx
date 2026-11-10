import { describe, expect, it } from 'vitest';
import { generateActivityHeatmap } from './analytics';

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

    it('defaults to 52 weeks and calculates month labels correctly', () => {
      const now = new Date('2026-11-09T12:00:00.000Z');
      const heatmap = generateActivityHeatmap([], undefined, now);

      expect(heatmap.days.length).toBe(52 * 7); // 364 days
      expect(heatmap.months.length).toBeGreaterThanOrEqual(11);
      expect(heatmap.months.length).toBeLessThanOrEqual(13);

      // Los meses deben estar en orden cronológico
      const firstMonth = heatmap.months[0];
      expect(firstMonth.weekIndex).toBe(0);
      expect(typeof firstMonth.name).toBe('string');
      expect(firstMonth.name.length).toBe(3);
    });
  });
});
