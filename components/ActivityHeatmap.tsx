'use client';

import React from 'react';
import { generateActivityHeatmap, type ActivityHeatmapData } from '@/lib/analytics';

interface ActivityHeatmapProps {
  tasks: { completed_at: string | null }[];
  weeks?: number;
}

const LEVEL_COLORS = [
  'var(--border)', // Level 0: no tasks
  'rgba(34, 197, 94, 0.35)', // Level 1: 1 task
  'rgba(34, 197, 94, 0.60)', // Level 2: 2-3 tasks
  'rgba(34, 197, 94, 0.85)', // Level 3: 4-5 tasks
  '#22c55e', // Level 4: 6+ tasks
];

const DAYS_OF_WEEK = ['L', '', 'M', '', 'V', '', 'D'];

export default function ActivityHeatmap({ tasks, weeks = 16 }: ActivityHeatmapProps) {
  const data: ActivityHeatmapData = React.useMemo(() => {
    return generateActivityHeatmap(tasks, weeks);
  }, [tasks, weeks]);

  // Group days by columns (weeks)
  const columns: typeof data.days[] = [];
  for (let i = 0; i < data.days.length; i += 7) {
    columns.push(data.days.slice(i, i + 7));
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 600 }}>Constancia y Hábitos</h3>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {data.totalCompletedInRange} tareas completadas en las últimas {weeks} semanas ({data.totalActiveDays} días activos)
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Menos</span>
          {LEVEL_COLORS.map((color, idx) => (
            <span
              key={idx}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: color,
                display: 'inline-block',
              }}
            />
          ))}
          <span>Más</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '0.25rem' }}>
        <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-start', minWidth: 'max-content' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginRight: '4px' }}>
            {DAYS_OF_WEEK.map((day, idx) => (
              <span
                key={idx}
                style={{
                  height: '11px',
                  fontSize: '9px',
                  lineHeight: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                  width: '10px',
                }}
              >
                {day}
              </span>
            ))}
          </div>

          {columns.map((col, colIdx) => (
            <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {col.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.count} ${day.count === 1 ? 'tarea completada' : 'tareas completadas'}`}
                  style={{
                    width: '11px',
                    height: '11px',
                    borderRadius: '2px',
                    background: LEVEL_COLORS[day.level],
                    transition: 'transform 0.1s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
