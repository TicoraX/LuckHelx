import { XP_SCALE } from './xp';

export type PomodoroMode = 'work' | 'short_break' | 'long_break';

export const POMODORO_CONFIG = {
  workDuration: 25 * 60, // 25 minutes
  shortBreakDuration: 5 * 60, // 5 minutes
  longBreakDuration: 15 * 60, // 15 minutes
  longBreakInterval: 4,
};

export function formatTimer(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getNextPomodoroState(
  current: PomodoroMode,
  completedCycles: number
): { nextMode: PomodoroMode; durationSeconds: number } {
  if (current === 'work') {
    if (completedCycles > 0 && completedCycles % POMODORO_CONFIG.longBreakInterval === 0) {
      return {
        nextMode: 'long_break',
        durationSeconds: POMODORO_CONFIG.longBreakDuration,
      };
    }
    return {
      nextMode: 'short_break',
      durationSeconds: POMODORO_CONFIG.shortBreakDuration,
    };
  }

  return {
    nextMode: 'work',
    durationSeconds: POMODORO_CONFIG.workDuration,
  };
}

export function calculateFocusXp(durationMinutes: number): number {
  // 0.5 XP per focused minute = 50 XP units
  return Math.round(durationMinutes * 50);
}
