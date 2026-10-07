import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { insertTask, completeTask } from './tasks-store';
import {
  getCs2Rank,
  CS2_RANKS,
  PREMIER_TIERS,
  PREMIER_MIN_RATING,
  getPremierTier,
  calculateStreakMultiplier,
  calculatePremierDecay,
  calculatePremierRating,
  derivePremierStatsFromTasks,
  formatPremierRating,
  syncPremierRating,
  getPremierPeakRating,
  getPremierHistory,
  getLatestPremierRating,
} from './ranks';

describe('CS2 Classic Ranks System (Backwards-Compatibility)', () => {
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

describe('CS2 Premier Rating System (HU-06)', () => {
  describe('7 Official Premier Color Bands', () => {
    it('defines exactly 7 tiers with correct ranges and colors', () => {
      expect(PREMIER_TIERS.length).toBe(7);

      const [grey, lightBlue, blue, purple, pink, red, gold] = PREMIER_TIERS;

      expect(grey.name).toBe('Gris');
      expect(grey.minRating).toBe(1000);
      expect(grey.maxRating).toBe(4999);
      expect(grey.color).toBe('#b0c3d9');

      expect(lightBlue.name).toBe('Celeste');
      expect(lightBlue.minRating).toBe(5000);
      expect(lightBlue.maxRating).toBe(9999);
      expect(lightBlue.color).toBe('#5e98d9');

      expect(blue.name).toBe('Azul');
      expect(blue.minRating).toBe(10000);
      expect(blue.maxRating).toBe(14999);
      expect(blue.color).toBe('#4b69ff');

      expect(purple.name).toBe('Violeta');
      expect(purple.minRating).toBe(15000);
      expect(purple.maxRating).toBe(19999);
      expect(purple.color).toBe('#8847ff');

      expect(pink.name).toBe('Rosa');
      expect(pink.minRating).toBe(20000);
      expect(pink.maxRating).toBe(24999);
      expect(pink.color).toBe('#d32ce6');

      expect(red.name).toBe('Rojo');
      expect(red.minRating).toBe(25000);
      expect(red.maxRating).toBe(29999);
      expect(red.color).toBe('#eb4b4b');

      expect(gold.name).toBe('Dorado');
      expect(gold.minRating).toBe(30000);
      expect(gold.color).toBe('#ffd700');
    });

    it('resolves correct tier for boundary values', () => {
      expect(getPremierTier(999).id).toBe('grey');
      expect(getPremierTier(1000).id).toBe('grey');
      expect(getPremierTier(4999).id).toBe('grey');
      expect(getPremierTier(5000).id).toBe('light_blue');
      expect(getPremierTier(9999).id).toBe('light_blue');
      expect(getPremierTier(10000).id).toBe('blue');
      expect(getPremierTier(14999).id).toBe('blue');
      expect(getPremierTier(15000).id).toBe('purple');
      expect(getPremierTier(19999).id).toBe('purple');
      expect(getPremierTier(20000).id).toBe('pink');
      expect(getPremierTier(24999).id).toBe('pink');
      expect(getPremierTier(25000).id).toBe('red');
      expect(getPremierTier(29999).id).toBe('red');
      expect(getPremierTier(30000).id).toBe('gold');
      expect(getPremierTier(35000).id).toBe('gold');
      expect(getPremierTier(99999).id).toBe('gold');
    });
  });

  describe('Streak Multiplier', () => {
    it('scales correctly and caps at 2.0x', () => {
      expect(calculateStreakMultiplier(0)).toBe(1.0);
      expect(calculateStreakMultiplier(1)).toBe(1.05);
      expect(calculateStreakMultiplier(7)).toBe(1.35);
      expect(calculateStreakMultiplier(14)).toBe(1.7);
      expect(calculateStreakMultiplier(20)).toBe(2.0);
      expect(calculateStreakMultiplier(30)).toBe(2.0); // Capped at 2.0x
      expect(calculateStreakMultiplier(-5)).toBe(1.0); // Safe fallback
    });
  });

  describe('Rank Decay Mechanics (> 2 Days Inactivity)', () => {
    it('does not decay for 0, 1, or 2 days of inactivity (grace period)', () => {
      const rating = 15000;
      expect(calculatePremierDecay(rating, 0)).toEqual({ rating: 15000, decayAmount: 0, daysDecayed: 0 });
      expect(calculatePremierDecay(rating, 1)).toEqual({ rating: 15000, decayAmount: 0, daysDecayed: 0 });
      expect(calculatePremierDecay(rating, 2)).toEqual({ rating: 15000, decayAmount: 0, daysDecayed: 0 });
    });

    it('progressively decays 250 points per day after 2 days of inactivity', () => {
      const rating = 15000;
      // 3 days: 1 day past grace = 250 pts decay
      const decay3 = calculatePremierDecay(rating, 3);
      expect(decay3.daysDecayed).toBe(1);
      expect(decay3.decayAmount).toBe(250);
      expect(decay3.rating).toBe(14750);

      // 6 days: 4 days past grace = 1,000 pts decay
      const decay6 = calculatePremierDecay(rating, 6);
      expect(decay6.daysDecayed).toBe(4);
      expect(decay6.decayAmount).toBe(1000);
      expect(decay6.rating).toBe(14000);
    });

    it('never drops below the calibrated minimum rating floor (1,000 pts)', () => {
      const lowRating = 1200;
      // 10 days inactive would be 8 * 250 = 2000 pts decay, but clamped to floor
      const decayResult = calculatePremierDecay(lowRating, 10);
      expect(decayResult.rating).toBe(PREMIER_MIN_RATING);
      expect(decayResult.decayAmount).toBe(200); // 1200 - 1000
    });
  });

  describe('Rating Calculation & Tier Progress', () => {
    it('calculates novice rating at minimum with 0 activity', () => {
      const result = calculatePremierRating({
        weeklyCompletedTasks: 0,
        streakDays: 0,
      });

      expect(result.rating).toBe(1000);
      expect(result.tier.id).toBe('grey');
      expect(result.isDecayed).toBe(false);
      expect(result.streakMultiplier).toBe(1.0);
      expect(result.formattedRating).toBe('1,000');
    });

    it('rewards weekly completed tasks and active streak multiplier', () => {
      // 10 tasks * 350 pts = 3,500 habit pts.
      // 7 days streak = 1.35x multiplier.
      // 3,500 * 1.35 = 4,725 pts.
      // Base floor: 1,000 pts.
      // Raw: 1,000 + 4,725 = 5,725 pts -> Celeste tier!
      const result = calculatePremierRating({
        weeklyCompletedTasks: 10,
        streakDays: 7,
      });

      expect(result.rawRating).toBe(5725);
      expect(result.rating).toBe(5725);
      expect(result.tier.id).toBe('light_blue');
      expect(result.tier.name).toBe('Celeste');
      expect(result.formattedRating).toBe('5,725');
    });

    it('calculates correct progress percentage toward next tier', () => {
      // Light blue tier spans 5,000 to 9,999 (span = 5,000 pts).
      // Rating 7,500 is exactly 50% through the tier.
      const result = calculatePremierRating({
        basePoints: 7500,
        weeklyCompletedTasks: 0,
        streakDays: 0,
      });

      expect(result.tier.id).toBe('light_blue');
      expect(result.nextTier?.id).toBe('blue');
      expect(result.progressPercent).toBe(50);
    });

    it('handles gold tier progress up to 35,000 pts', () => {
      const result = calculatePremierRating({
        basePoints: 32500,
        weeklyCompletedTasks: 0,
        streakDays: 0,
      });

      expect(result.tier.id).toBe('gold');
      expect(result.nextTier).toBeNull();
      // 32,500 is 50% between 30,000 and 35,000
      expect(result.progressPercent).toBe(50);
    });

    it('formats rating cleanly with commas', () => {
      expect(formatPremierRating(12500)).toBe('12,500');
      expect(formatPremierRating(32450)).toBe('32,450');
      expect(formatPremierRating(950)).toBe('1,000'); // Clamped to min
    });
  });

  describe('derivePremierStatsFromTasks', () => {
    it('derives accurate weekly window and inactivity decay from task history', () => {
      const now = new Date('2026-10-07T12:00:00Z');
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      const mockTasks = [
        // 2 tasks yesterday (within 7 days)
        {
          id: '1',
          status: 'credited',
          completed_at: new Date(now.getTime() - ONE_DAY_MS).toISOString(),
        },
        {
          id: '2',
          status: 'credited',
          completed_at: new Date(now.getTime() - ONE_DAY_MS).toISOString(),
        },
        // 1 task 3 days ago (within 7 days)
        {
          id: '3',
          status: 'credited',
          completed_at: new Date(now.getTime() - 3 * ONE_DAY_MS).toISOString(),
        },
        // 1 old task 12 days ago (outside 7-day rolling window)
        {
          id: '4',
          status: 'credited',
          completed_at: new Date(now.getTime() - 12 * ONE_DAY_MS).toISOString(),
        },
        // 1 evaluated task (not credited)
        {
          id: '5',
          status: 'evaluated',
          completed_at: null,
        },
      ];

      const stats = derivePremierStatsFromTasks(mockTasks, 50000, now); // 500 XP = 50,000 units
      expect(stats.daysInactive).toBe(1); // Completed yesterday
      expect(stats.isDecayed).toBe(false); // <= 2 days
      expect(stats.rating).toBeGreaterThan(1000);
    });

    it('triggers rank decay when all tasks are older than 2 days', () => {
      const now = new Date('2026-10-07T12:00:00Z');
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      const oldTasks = [
        {
          id: '1',
          status: 'credited',
          completed_at: new Date(now.getTime() - 5 * ONE_DAY_MS).toISOString(),
        },
      ];

      // Provide totalXpUnits (10,000 XP = 1,000 pts bonus) so rawRating is 2,350 pts
      // 5 days inactive: 3 days decayed = 750 pts decay without hitting floor
      const stats = derivePremierStatsFromTasks(oldTasks, 10000 * 100, now);
      expect(stats.daysInactive).toBe(5);
      expect(stats.isDecayed).toBe(true);
      expect(stats.decayAmount).toBe(750); // (5 - 2) * 250
      expect(stats.rating).toBe(1600); // 2350 - 750

      // Also verify that with zero XP, decay is clamped to floor (1,000 pts)
      const clampedStats = derivePremierStatsFromTasks(oldTasks, 0, now);
      expect(clampedStats.rating).toBe(1000);
      expect(clampedStats.decayAmount).toBe(350); // clamped by (1350 - 1000)
    });
  });

  describe('SQLite Persistence & Daily Snapshots', () => {
    it('initializes premier peak rating to 1,000 in meta table', () => {
      const db = createTestDb();
      expect(getPremierPeakRating(db)).toBe(1000);
    });

    it('syncs and persists daily premier rating snapshot to SQLite', () => {
      const db = createTestDb();
      const now = new Date('2026-10-07T14:00:00Z');

      const synced = syncPremierRating(db, now);
      expect(synced.rating).toBe(1000);
      expect(synced.peakRating).toBe(1000);

      const latest = getLatestPremierRating(db);
      expect(latest).not.toBeNull();
      expect(latest?.rating).toBe(1000);
      expect(latest?.tier).toBe('grey');
      expect(latest?.recorded_date).toBe('2026-10-07');

      const history = getPremierHistory(db);
      expect(history.length).toBe(1);
    });

    it('updates peak rating when task completion elevates rating', () => {
      const db = createTestDb();
      const now = new Date('2026-10-07T14:00:00Z');

      // Create and complete high-value task
      const task = insertTask(db, {
        title: 'Gran entrega de arquitectura',
        description: 'Hardening completo',
        descriptionNormalized: 'gran entrega',
        xpValue: 50000 * 100, // 50,000 XP
      });
      completeTask(db, task.id);

      const synced = syncPremierRating(db, now);
      expect(synced.rating).toBeGreaterThan(1000);
      expect(synced.peakRating).toBe(synced.rating);
      expect(getPremierPeakRating(db)).toBe(synced.rating);

      // Verify idempotency on same day: updates existing row rather than duplicating
      const syncedAgain = syncPremierRating(db, now);
      expect(syncedAgain.rating).toBe(synced.rating);
      const history = getPremierHistory(db);
      expect(history.length).toBe(1);
    });
  });
});
