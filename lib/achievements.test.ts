import { describe, it, expect } from 'vitest';
import { evaluateAchievements, ACHIEVEMENTS_CATALOG } from './achievements';

describe('Achievements System', () => {
  it('has 16 achievements distributed in 4 categories', () => {
    expect(ACHIEVEMENTS_CATALOG.length).toBe(16);
    const categories = new Set(ACHIEVEMENTS_CATALOG.map((a) => a.category));
    expect(Array.from(categories).sort()).toEqual(['cs2', 'economy', 'streaks', 'tasks']);
  });

  it('evaluates unlocked status and progress correctly for initial stats', () => {
    const list = evaluateAchievements({
      totalTasksCompleted: 0,
      currentStreak: 0,
      lifetimeXp: 0,
      totalRewardsRedeemed: 0,
      tradeUpsCompleted: 0,
    });

    expect(list.every((a) => !a.unlocked)).toBe(true);
    expect(list.every((a) => a.progressPercent === 0)).toBe(true);
  });

  it('unlocks task achievements when targets are met', () => {
    const list = evaluateAchievements({
      totalTasksCompleted: 10,
      currentStreak: 3,
      lifetimeXp: 50000,
      totalRewardsRedeemed: 2,
      tradeUpsCompleted: 1,
    });

    const firstStep = list.find((a) => a.id === 'task_1');
    expect(firstStep?.unlocked).toBe(true);
    expect(firstStep?.progressPercent).toBe(100);

    const productive = list.find((a) => a.id === 'task_10');
    expect(productive?.unlocked).toBe(true);

    const machine = list.find((a) => a.id === 'task_50');
    expect(machine?.unlocked).toBe(false);
    expect(machine?.progressPercent).toBe(20); // 10/50 = 20%
  });
});
