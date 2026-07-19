'use client';

import AnimatedNumber from './AnimatedNumber';

export default function XpProgressBar({ xp }: { xp: number }) {
  const currentLevel = Math.floor(xp / 100) + 1;
  const currentXpInLevel = xp % 100;
  const progressPercent = Math.min(100, Math.max(0, currentXpInLevel));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
        <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Nivel {currentLevel}</span>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          <strong style={{ color: 'var(--accent-xp)' }}>
            <AnimatedNumber value={currentXpInLevel} /> XP
          </strong>{' '}
          / 100 XP
        </span>
      </div>
      <div className="xp-progress-bar">
        <div className="xp-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}
