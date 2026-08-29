import { describe, it, expect } from 'vitest';
import { formatTimer, getNextPomodoroState, calculateFocusXp } from './pomodoro';

describe('Pomodoro Engine', () => {
  describe('formatTimer', () => {
    it('formats seconds into MM:SS correctly', () => {
      expect(formatTimer(1500)).toBe('25:00');
      expect(formatTimer(305)).toBe('05:05');
      expect(formatTimer(0)).toBe('00:00');
      expect(formatTimer(59)).toBe('00:59');
    });
  });

  describe('getNextPomodoroState', () => {
    it('transitions from work to short break on normal cycles', () => {
      const next = getNextPomodoroState('work', 1);
      expect(next.nextMode).toBe('short_break');
      expect(next.durationSeconds).toBe(300); // 5 min
    });

    it('transitions from work to long break on every 4th cycle', () => {
      const next = getNextPomodoroState('work', 4);
      expect(next.nextMode).toBe('long_break');
      expect(next.durationSeconds).toBe(900); // 15 min
    });

    it('transitions from break back to work', () => {
      const next = getNextPomodoroState('short_break', 1);
      expect(next.nextMode).toBe('work');
      expect(next.durationSeconds).toBe(1500); // 25 min
    });
  });

  describe('calculateFocusXp', () => {
    it('awards bonus XP proportionally to focus minutes in centesimal units', () => {
      // 25 minutes = 25 * 50 = 1250 units (12.5 XP)
      expect(calculateFocusXp(25)).toBe(1250);
      expect(calculateFocusXp(50)).toBe(2500);
    });
  });
});
