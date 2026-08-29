'use client';

import React, { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';
import SoundToggle from './SoundToggle';
import { IconLedger } from './Icons';
import { getCs2Rank } from '@/lib/ranks';

export default function Header({
  left,
  children,
  xpBalance,
}: {
  left?: React.ReactNode;
  children?: React.ReactNode;
  xpBalance?: number;
}) {
  const [balance, setBalance] = useState<number>(xpBalance ?? 0);

  useEffect(() => {
    if (xpBalance !== undefined) {
      setBalance(xpBalance);
    } else {
      fetch('/api/state')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.xpBalance === 'number') {
            setBalance(data.xpBalance);
          }
        })
        .catch(() => {});
    }
  }, [xpBalance]);

  const rank = getCs2Rank(balance);

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <a href="/" className="header-brand">
          <div className="brand-icon">
            <IconLedger size={20} color="#ffffff" />
          </div>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Recompensas<span style={{ color: 'var(--accent-primary)' }}>.</span>
          </span>
        </a>

        {/* CS2 Rank Badge */}
        <div
          title={
            rank.nextRankMinXp
              ? `Rango CS2: ${rank.rankName} (${rank.progressPercent}% hacia el siguiente rango)`
              : `Rango CS2: ${rank.rankName} (Rango Máximo)`
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
          <span>🎖️ {rank.rankName}</span>
        </div>

        {left}
      </div>
      <div className="header-actions">
        {children}
        <SoundToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
