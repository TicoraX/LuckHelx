'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { type ActivityHeatmapData, generateActivityHeatmap } from '@/lib/analytics';

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
const CELL_SIZE = 12;
const CELL_GAP = 3;

export default function ActivityHeatmap({ tasks, weeks = 52 }: ActivityHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const data: ActivityHeatmapData = useMemo(() => {
    return generateActivityHeatmap(tasks, weeks);
  }, [tasks, weeks]);

  // Group days by columns (weeks)
  const columns: (typeof data.days)[] = useMemo(() => {
    const cols: (typeof data.days)[] = [];
    for (let i = 0; i < data.days.length; i += 7) {
      cols.push(data.days.slice(i, i + 7));
    }
    return cols;
  }, [data.days]);

  // Auto-scroll to current week on mobile/smaller viewports
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data]);

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.85rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 600 }}>Constancia y Hábitos</h3>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {data.totalCompletedInRange}{' '}
            {data.totalCompletedInRange === 1 ? 'tarea completada' : 'tareas completadas'}{' '}
            {weeks >= 50 ? 'en el último año' : `en las últimas ${weeks} semanas`} ({data.totalActiveDays}{' '}
            {data.totalActiveDays === 1 ? 'día activo' : 'días activos'})
          </p>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
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

      <div
        ref={scrollRef}
        style={{
          overflowX: 'auto',
          paddingBottom: '0.5rem',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ minWidth: 'max-content' }}>
          {/* Months header */}
          <div
            style={{
              position: 'relative',
              height: '16px',
              marginBottom: '4px',
              marginLeft: '18px',
            }}
          >
            {data.months.map((m, idx) => (
              <span
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${m.weekIndex * (CELL_SIZE + CELL_GAP)}px`,
                  fontSize: '10px',
                  lineHeight: '12px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {m.name}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: `${CELL_GAP}px`, alignItems: 'flex-start' }}>
            {/* Days of week labels */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: `${CELL_GAP}px`,
                marginRight: '3px',
              }}
            >
              {DAYS_OF_WEEK.map((day, idx) => (
                <span
                  key={idx}
                  style={{
                    height: `${CELL_SIZE}px`,
                    fontSize: '9px',
                    lineHeight: `${CELL_SIZE}px`,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    width: '12px',
                  }}
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Weeks columns */}
            {columns.map((col, colIdx) => (
              <div
                key={colIdx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${CELL_GAP}px`,
                }}
              >
                {col.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count} ${day.count === 1 ? 'tarea completada' : 'tareas completadas'}`}
                    style={{
                      width: `${CELL_SIZE}px`,
                      height: `${CELL_SIZE}px`,
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
    </div>
  );
}
