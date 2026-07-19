'use client';

import React from 'react';
import { IconFlame } from './Icons';

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
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--accent-xp)',
        padding: '0.35rem 0.85rem',
        borderRadius: '4px',
        fontWeight: 700,
        fontSize: '0.9rem',
      }}
      title="Días consecutivos activo completando tareas"
    >
      <IconFlame size={15} />
      <span><span className="mono-value">{displayStreak}</span> {displayStreak === 1 ? 'día de racha' : 'días de racha'}</span>
    </div>
  );
}
