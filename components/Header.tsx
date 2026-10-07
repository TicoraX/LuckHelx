'use client';

import React, { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';
import SoundToggle from './SoundToggle';
import PomodoroWidget from './PomodoroWidget';
import { IconLedger, IconMedal } from './Icons';
import { getCs2Rank } from '@/lib/ranks';
import PremierRatingBadge from './PremierRatingBadge';

export default function Header({
  left,
  children,
  xpBalance,
  tasks,
}: {
  left?: React.ReactNode;
  children?: React.ReactNode;
  xpBalance?: number;
  tasks?: Array<{ completed_at: string | null; status: string }>;
}) {
  const [balance, setBalance] = useState<number>(xpBalance ?? 0);
  const [tasksList, setTasksList] = useState<Array<{ completed_at: string | null; status: string }>>(tasks ?? []);

  useEffect(() => {
    if (xpBalance !== undefined) {
      setBalance(xpBalance);
    }
    if (tasks !== undefined) {
      setTasksList(tasks);
    }
    if (xpBalance === undefined || tasks === undefined) {
      fetch('/api/state')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.xpBalance === 'number' && xpBalance === undefined) {
            setBalance(data.xpBalance);
          }
          if (data && Array.isArray(data.tasks) && tasks === undefined) {
            setTasksList(data.tasks);
          }
        })
        .catch(() => {});
    }
  }, [xpBalance, tasks]);

  const rank = getCs2Rank(balance);

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <a href="/" className="header-brand">
          <div className="brand-icon">
            <IconLedger size={20} color="#ffffff" />
          </div>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Recompensas<span style={{ color: 'var(--accent-primary)' }}>.</span>
          </span>
        </a>

        {/* CS2 Classic Rank Badge */}
        <div
          title={
            rank.nextRankMinXp
              ? `Rango Clásico: ${rank.rankName} (${rank.progressPercent}% hacia el siguiente rango)`
              : `Rango Clásico: ${rank.rankName} (Rango Máximo)`
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.55rem',
            borderRadius: '4px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--accent-xp)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <IconMedal size={14} color="var(--accent-xp)" />
            {rank.rankName}
          </span>
        </div>

        {/* CS2 Premier Rating Badge */}
        <PremierRatingBadge
          compact
          tasks={tasksList}
          xpUnits={balance}
        />

        {left}
      </div>
      <div className="header-actions">
        {children}
        <PomodoroWidget />
        <SoundToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
