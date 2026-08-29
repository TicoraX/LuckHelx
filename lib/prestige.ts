import type { Db } from './db';
import { listTasks } from './tasks-store';

export interface PrestigeStatus {
  prestigeLevel: number;
  completedTasksCount: number;
  tasksNeeded: number;
  canPrestige: boolean;
  activeMedal: string | null;
}

const MEDAL_NAMES = [
  'Sin medalla de servicio',
  'Medalla de Servicio 2026 - Rango 1 (Azul)',
  'Medalla de Servicio 2026 - Rango 2 (Púrpura)',
  'Medalla de Servicio 2026 - Rango 3 (Rosa)',
  'Medalla de Servicio 2026 - Rango 4 (Rojo)',
  'Medalla de Servicio 2026 - Rango 5 (Élite Dorada)',
];

export function getPrestigeStatus(db: Db): PrestigeStatus {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'prestige_level'").get() as
    | { value: string }
    | undefined;
  const prestigeLevel = Number(row?.value ?? '0');

  const tasks = listTasks(db);
  const completedTasksCount = tasks.filter((t) => t.status === 'credited').length;

  const targetForNext = (prestigeLevel + 1) * 25;
  const canPrestige = prestigeLevel < 5 && completedTasksCount >= targetForNext;

  return {
    prestigeLevel,
    completedTasksCount,
    tasksNeeded: targetForNext,
    canPrestige,
    activeMedal: prestigeLevel > 0 ? MEDAL_NAMES[prestigeLevel] : null,
  };
}

export function claimPrestige(db: Db): { newLevel: number; medalName: string } {
  const status = getPrestigeStatus(db);
  if (!status.canPrestige) {
    throw new Error(`Aún no cumples los requisitos de prestigio (${status.completedTasksCount}/${status.tasksNeeded} tareas)`);
  }

  const newLevel = status.prestigeLevel + 1;

  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('prestige_level', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(String(newLevel));

  return {
    newLevel,
    medalName: MEDAL_NAMES[newLevel],
  };
}
