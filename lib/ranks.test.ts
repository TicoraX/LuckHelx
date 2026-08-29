import { describe, it, expect } from 'vitest';
import { getCs2Rank, CS2_RANKS } from './ranks';

describe('CS2 Ranks System', () => {
  it('assigns Silver I to zero or low XP', () => {
    const rank0 = getCs2Rank(0);
    expect(rank0.rankName).toBe('Silver I');
    expect(rank0.progressPercent).toBe(0);

    const rank50 = getCs2Rank(50 * 100); // 50 XP in units
    expect(rank50.rankName).toBe('Silver I');
    expect(rank50.progressPercent).toBe(50);
  });

  it('assigns higher ranks progressively as XP grows', () => {
    const nova = getCs2Rank(3500 * 100);
    expect(nova.rankName).toBe('Gold Nova I');

    const globalElite = getCs2Rank(150000 * 100);
    expect(globalElite.rankName).toBe('The Global Elite');
    expect(globalElite.nextRankMinXp).toBeNull();
    expect(globalElite.progressPercent).toBe(100);
  });

  it('contains exactly 18 ranks ordered ascending by minXp', () => {
    expect(CS2_RANKS.length).toBe(18);
    for (let i = 1; i < CS2_RANKS.length; i++) {
      expect(CS2_RANKS[i].minXp).toBeGreaterThan(CS2_RANKS[i - 1].minXp);
    }
  });
});
