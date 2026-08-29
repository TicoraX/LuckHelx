import { randomUUID } from 'crypto';
import type { Db } from './db';
import { incrementXpBalance } from './settings-store';
import { XP_SCALE } from './xp';

export interface DailySpinStatus {
  canSpin: boolean;
  lastSpunDate: string | null;
}

export interface DailySpinResult {
  rewardType: 'xp_small' | 'xp_medium' | 'free_key' | 'jackpot';
  label: string;
  xpAwarded: number; // in XP units
}

export function getDailySpinStatus(db: Db, dateIso: string = new Date().toISOString()): DailySpinStatus {
  const dateKey = new Date(dateIso).toISOString().split('T')[0];
  const row = db.prepare('SELECT spin_date FROM daily_spins WHERE spin_date = ?').get(dateKey) as
    | { spin_date: string }
    | undefined;

  return {
    canSpin: !row,
    lastSpunDate: row?.spin_date ?? null,
  };
}

export function executeDailySpin(db: Db, dateIso: string = new Date().toISOString()): DailySpinResult {
  const status = getDailySpinStatus(db, dateIso);
  if (!status.canSpin) {
    throw new Error('ya utilizaste tu giro diario gratuito de hoy');
  }

  const dateKey = new Date(dateIso).toISOString().split('T')[0];
  const now = new Date().toISOString();

  // Random probabilities:
  // 50% -> xp_small (15 XP = 1500 units)
  // 30% -> xp_medium (35 XP = 3500 units)
  // 15% -> free_key (80 XP = 8000 units)
  // 5%  -> jackpot (150 XP = 15000 units)
  const roll = Math.random();
  let rewardType: DailySpinResult['rewardType'] = 'xp_small';
  let label = '+15 XP';
  let xpAwardedUnits = 15 * XP_SCALE;

  if (roll < 0.05) {
    rewardType = 'jackpot';
    label = '🎰 ¡JACKPOT! +150 XP';
    xpAwardedUnits = 150 * XP_SCALE;
  } else if (roll < 0.20) {
    rewardType = 'free_key';
    label = '🔑 Llave Gratis (+80 XP)';
    xpAwardedUnits = 80 * XP_SCALE;
  } else if (roll < 0.50) {
    rewardType = 'xp_medium';
    label = '+35 XP';
    xpAwardedUnits = 35 * XP_SCALE;
  }

  const spinId = randomUUID();

  db.transaction(() => {
    db.prepare(
      'INSERT INTO daily_spins (id, spin_date, reward_type, xp_awarded, spun_at) VALUES (?, ?, ?, ?, ?)'
    ).run(spinId, dateKey, rewardType, xpAwardedUnits, now);

    incrementXpBalance(db, xpAwardedUnits);
  })();

  return {
    rewardType,
    label,
    xpAwarded: xpAwardedUnits,
  };
}
