import { localDayIndex, localDayKey } from './date';

export interface HeatmapDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapMonthLabel {
  name: string;
  weekIndex: number;
}

export interface ActivityHeatmapData {
  days: HeatmapDay[];
  totalActiveDays: number;
  totalCompletedInRange: number;
  months: HeatmapMonthLabel[];
}

export const MONTH_NAMES_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

function countToLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

export function generateActivityHeatmap(
  tasks: { completed_at: string | null }[],
  weeksCount = 52,
  now: Date = new Date()
): ActivityHeatmapData {
  const countsByDate = new Map<string, number>();

  for (const t of tasks) {
    if (!t.completed_at) continue;
    const dateKey = localDayKey(new Date(t.completed_at));
    countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
  }

  // Fin de la semana actual (domingo). La grilla vive en indices de dia local, asi que los
  // metodos getUTC* de aca abajo leen el calendario local (ver lib/date.ts).
  const endDate = new Date(localDayIndex(now));
  const dayOfWeek = endDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const daysUntilEndOfWeek = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  endDate.setUTCDate(endDate.getUTCDate() + daysUntilEndOfWeek);

  const totalDays = weeksCount * 7;
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - (totalDays - 1));

  const days: HeatmapDay[] = [];
  let totalActiveDays = 0;
  let totalCompletedInRange = 0;

  const current = new Date(startDate);
  for (let i = 0; i < totalDays; i++) {
    const key = current.toISOString().split('T')[0];
    const count = countsByDate.get(key) ?? 0;
    const level = countToLevel(count);

    if (count > 0) {
      totalActiveDays++;
      totalCompletedInRange += count;
    }

    days.push({
      date: key,
      count,
      level,
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  // Calcular etiquetas de meses alineadas a las semanas (estilo GitHub)
  const months: HeatmapMonthLabel[] = [];
  let lastMonth = -1;

  for (let w = 0; w < weeksCount; w++) {
    const weekDays = days.slice(w * 7, (w + 1) * 7);
    if (weekDays.length === 0) continue;

    // Buscar si el día 1 del mes cae en esta semana
    const dayOne = weekDays.find((d) => d.date.endsWith('-01'));
    if (dayOne) {
      const m1 = new Date(dayOne.date + 'T00:00:00Z').getUTCMonth();
      if (m1 !== lastMonth) {
        months.push({ name: MONTH_NAMES_ES[m1], weekIndex: w });
        lastMonth = m1;
      }
    } else if (w === 0) {
      const mStart = new Date(weekDays[0].date + 'T00:00:00Z').getUTCMonth();
      months.push({ name: MONTH_NAMES_ES[mStart], weekIndex: 0 });
      lastMonth = mStart;
    }
  }

  // Evita solapar la etiqueta inicial con la siguiente si estan a menos de 2 semanas (< 30px)
  if (months.length > 1 && months[1].weekIndex - months[0].weekIndex < 2) {
    months.shift();
  }

  return {
    days,
    totalActiveDays,
    totalCompletedInRange,
    months,
  };
}
