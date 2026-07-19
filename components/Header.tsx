'use client';

import React from 'react';
import ThemeToggle from './ThemeToggle';
import SoundToggle from './SoundToggle';

export default function Header({
  left,
  children,
}: {
  left?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <a href="/" className="header-brand">
          <div className="brand-icon">⚡</div>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            EStiri<span style={{ color: 'var(--accent-primary)' }}>.</span>
          </span>
        </a>
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
