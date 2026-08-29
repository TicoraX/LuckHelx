import { randomUUID } from 'crypto';
import type { Db } from './db';
import { listTasks } from './tasks-store';
import { incrementXpBalance } from './settings-store';
import { XP_SCALE } from './xp';
import { calculateStreakFromDates } from './streak';

export interface QuestProgress {
  id: string;
  type: 'daily' | 'weekly';
  title: string;
  description: string;
  target: number;
  progress: number;
  bonusXp: number; // in XP units
  completed: boolean;
  claimed: boolean;
}

export function listQuestsWithProgress(db: Db, dateIso: string = new Date().toISOString()): QuestProgress[] {
  const dateObj = new Date(dateIso);
  const dateKey = dateObj.toISOString().split('T')[0];

  const day = dateObj.getDay();
  const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), diff);
  const weekKey = weekStart.toISOString().split('T')[0];

  const tasks = listTasks(db);
  const streak = calculateStreakFromDates(tasks.map((t) => t.completed_at), 0);

  const todayTasks = tasks.filter((t) => {
    if (t.status !== 'credited' || !t.completed_at) return false;
    const taskDate = new Date(t.completed_at).toISOString().split('T')[0];
    return taskDate === dateKey;
  });

  const todayCompletedCount = todayTasks.length;
  const todayXpUnits = todayTasks.reduce((acc, curr) => acc + (curr.xp_value ?? 0), 0);
  const todayNaturalXp = Math.floor(todayXpUnits / XP_SCALE);

  const categories = ['trabajo', 'estudio', 'salud', 'personal'];
  const dayNum = dateObj.getDate();
  const targetCategory = categories[dayNum % categories.length];
  const todayCategoryCount = todayTasks.filter((t) => (t.category ?? 'general').toLowerCase() === targetCategory).length;

  const questDefs = [
    {
      id: `daily_tasks_${dateKey}`,
      type: 'daily' as const,
      title: 'Trilogía del Día',
      description: 'Completa al menos 3 tareas hoy',
      target: 3,
      current: todayCompletedCount,
      bonusXpUnits: 25 * XP_SCALE,
    },
    {
      id: `daily_cat_${targetCategory}_${dateKey}`,
      type: 'daily' as const,
      title: `Especialista en ${targetCategory.charAt(0).toUpperCase() + targetCategory.slice(1)}`,
      description: `Completa 1 tarea de categoría "${targetCategory}" hoy`,
      target: 1,
      current: todayCategoryCount,
      bonusXpUnits: 35 * XP_SCALE,
    },
    {
      id: `daily_xp_${dateKey}`,
      type: 'daily' as const,
      title: 'Impulso de Experiencia',
      description: 'Gana 50 XP en tareas hoy',
      target: 50,
      current: todayNaturalXp,
      bonusXpUnits: 40 * XP_SCALE,
    },
    {
      id: `weekly_streak_${weekKey}`,
      type: 'weekly' as const,
      title: 'Hábito Semanal de Acero',
      description: 'Mantén una racha de al menos 5 días esta semana',
      target: 5,
      current: streak,
      bonusXpUnits: 150 * XP_SCALE,
    },
  ];

  const claims = db
    .prepare('SELECT quest_id FROM quest_claims WHERE quest_id IN (?, ?, ?, ?)')
    .all(questDefs.map((q) => q.id)) as { quest_id: string }[];
  const claimedSet = new Set(claims.map((c) => c.quest_id));

  return questDefs.map((q) => {
    const progress = Math.min(q.target, q.current);
    const completed = q.current >= q.target;
    const claimed = claimedSet.has(q.id);

    return {
      id: q.id,
      type: q.type,
      title: q.title,
      description: q.description,
      target: q.target,
      progress,
      bonusXp: q.bonusXpUnits,
      completed,
      claimed,
    };
  });
}

export function claimQuest(db: Db, questId: string, dateIso: string = new Date().toISOString()): { xpAwarded: number } {
  const quests = listQuestsWithProgress(db, dateIso);
  const quest = quests.find((q) => q.id === questId);

  if (!quest) {
    throw new Error('mision no encontrada');
  }

  if (!quest.completed) {
    throw new Error('la mision todavia no ha sido completada');
  }

  if (quest.claimed) {
    throw new Error('esta mision ya fue reclamada');
  }

  const claimId = randomUUID();
  const dateKey = new Date(dateIso).toISOString().split('T')[0];
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      'INSERT INTO quest_claims (id, quest_id, claimed_date, xp_awarded, claimed_at) VALUES (?, ?, ?, ?, ?)'
    ).run(claimId, quest.id, dateKey, quest.bonusXp, now);

    incrementXpBalance(db, quest.bonusXp);
  })();

  return { xpAwarded: quest.bonusXp };
}
