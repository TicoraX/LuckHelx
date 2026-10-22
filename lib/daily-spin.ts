import { randomUUID } from 'crypto';
import type { Db } from './db';
import { incrementXpBalance } from './settings-store';

export interface DailySpinStatus {
  canSpin: boolean;
  lastSpunDate: string | null;
}

export interface DailySpinResult {
  rewardType: 'xp_small' | 'xp_medium' | 'free_key' | 'jackpot';
  label: string;
  xpAwarded: number; // in XP units
}

export function getDailySpinStatus(
  db: Db,
  dateIso: string = new Date().toISOString()
): DailySpinStatus {
  const dateKey = new Date(dateIso).toISOString().split('T')[0];
  const row = db.prepare('SELECT spin_date FROM daily_spins WHERE spin_date = ?').get(dateKey) as
    | { spin_date: string }
    | undefined;

  return {
    canSpin: !row,
    lastSpunDate: row?.spin_date ?? null,
  };
}

export function executeDailySpin(
  db: Db,
  dateIso: string = new Date().toISOString()
): DailySpinResult {
  const status = getDailySpinStatus(db, dateIso);
  if (!status.canSpin) {
    throw new Error('ya utilizaste tu giro diario gratuito de hoy');
  }

  const dateKey = new Date(dateIso).toISOString().split('T')[0];
  const now = new Date().toISOString();

  // Probabilidades calibradas a escala 1:1 CS2:
  // 50% -> xp_small (1.50 XP = 150 unidades, valor de una caja estándar)
  // 30% -> xp_medium (3.50 XP = 350 unidades)
  // 15% -> free_key (2.49 XP = 249 unidades, costo oficial de llave CS2)
  // 5%  -> jackpot (15.00 XP = 1500 unidades, premio mayor)
  const roll = Math.random();
  let rewardType: DailySpinResult['rewardType'] = 'xp_small';
  let label = '+1.50 XP';
  let xpAwardedUnits = 150;

  if (roll < 0.05) {
    rewardType = 'jackpot';
    label = '¡Premio Mayor! +15.00 XP';
    xpAwardedUnits = 1500;
  } else if (roll < 0.2) {
    rewardType = 'free_key';
    label = 'Llave CS2 (+2.49 XP)';
    xpAwardedUnits = 249;
  } else if (roll < 0.5) {
    rewardType = 'xp_medium';
    label = '+3.50 XP';
    xpAwardedUnits = 350;
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
