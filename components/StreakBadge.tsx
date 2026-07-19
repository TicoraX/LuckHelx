'use client';

import React from 'react';

interface StreakBadgeProps {
  streak?: number;
}

export default function StreakBadge({ streak = 1 }: StreakBadgeProps) {
  const displayStreak = Number.isFinite(streak) && streak >= 0 ? Math.floor(streak) : 1;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(245, 158, 11, 0.2))',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        color: '#f59e0b',
        padding: '0.35rem 0.85rem',
        borderRadius: '999px',
        fontWeight: 700,
        fontSize: '0.9rem',
        boxShadow: '0 0 12px rgba(245, 158, 11, 0.2)',
      }}
      title="Días consecutivos activo completando tareas"
    >
      <span>🔥</span>
      <span>{displayStreak} {displayStreak === 1 ? 'Día de Racha' : 'Días de Racha'}</span>
    </div>
  );
}
