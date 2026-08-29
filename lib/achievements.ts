import { XP_SCALE } from './xp';

export type AchievementCategory = 'tasks' | 'streaks' | 'economy' | 'cs2';

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  target: number;
  icon: string;
}

export interface AchievementProgress extends AchievementDef {
  current: number;
  unlocked: boolean;
  progressPercent: number;
}

export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  // Tareas
  { id: 'task_1', category: 'tasks', name: 'Primer Paso', description: 'Completa tu primera tarea', target: 1, icon: '🎯' },
  { id: 'task_10', category: 'tasks', name: 'Productivo', description: 'Completa 10 tareas', target: 10, icon: '⚡' },
  { id: 'task_50', category: 'tasks', name: 'Máquina de Tareas', description: 'Completa 50 tareas', target: 50, icon: '🔥' },
  { id: 'task_100', category: 'tasks', name: 'Centurión', description: 'Completa 100 tareas', target: 100, icon: '👑' },

  // Rachas
  { id: 'streak_3', category: 'streaks', name: 'Calentando', description: 'Mantén una racha de 3 días', target: 3, icon: '🌱' },
  { id: 'streak_7', category: 'streaks', name: 'En Racha', description: 'Mantén una racha de 7 días', target: 7, icon: '🚀' },
  { id: 'streak_14', category: 'streaks', name: 'Hábito de Acero', description: 'Mantén una racha de 14 días', target: 14, icon: '🛡️' },
  { id: 'streak_30', category: 'streaks', name: 'Inquebrantable', description: 'Mantén una racha de 30 días', target: 30, icon: '💎' },

  // Economía
  { id: 'xp_100', category: 'economy', name: 'Primer Ahorro', description: 'Alcanza 100 XP', target: 100, icon: '🪙' },
  { id: 'xp_1000', category: 'economy', name: 'Billetera Llena', description: 'Alcanza 1,000 XP', target: 1000, icon: '💰' },
  { id: 'xp_10000', category: 'economy', name: 'Magnate del XP', description: 'Alcanza 10,000 XP', target: 10000, icon: '🏦' },
  { id: 'xp_50000', category: 'economy', name: 'Inversionista', description: 'Alcanza 50,000 XP', target: 50000, icon: '🌟' },

  // CS2
  { id: 'cs2_open_1', category: 'cs2', name: 'Primera Caja', description: 'Abre tu primer cofre', target: 1, icon: '📦' },
  { id: 'cs2_open_10', category: 'cs2', name: 'Coleccionista', description: 'Abre 10 cofres', target: 10, icon: '🎁' },
  { id: 'cs2_open_50', category: 'cs2', name: 'Apostador Nato', description: 'Abre 50 cofres', target: 50, icon: '🎰' },
  { id: 'cs2_trade_up', category: 'cs2', name: 'Trade-Up Master', description: 'Completa 1 contrato de intercambio', target: 1, icon: '✨' },
];

export function evaluateAchievements(stats: {
  totalTasksCompleted: number;
  currentStreak: number;
  lifetimeXp: number;
  totalRewardsRedeemed: number;
  tradeUpsCompleted?: number;
}): AchievementProgress[] {
  const naturalXp = Math.floor(stats.lifetimeXp / XP_SCALE);
  const tradeUps = stats.tradeUpsCompleted ?? 0;

  return ACHIEVEMENTS_CATALOG.map((def) => {
    let current = 0;
    if (def.category === 'tasks') current = stats.totalTasksCompleted;
    else if (def.category === 'streaks') current = stats.currentStreak;
    else if (def.category === 'economy') current = naturalXp;
    else if (def.category === 'cs2') {
      if (def.id === 'cs2_trade_up') current = tradeUps;
      else current = stats.totalRewardsRedeemed;
    }

    const unlocked = current >= def.target;
    const progressPercent = unlocked ? 100 : Math.min(99, Math.max(0, Math.floor((current / def.target) * 100)));

    return {
      ...def,
      current,
      unlocked,
      progressPercent,
    };
  });
}
