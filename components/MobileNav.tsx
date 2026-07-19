'use client';

import React from 'react';
import { soundFX } from '@/lib/sound';

interface MobileNavProps {
  activeTab: 'dashboard' | 'rewards';
  onOpenAchievements?: () => void;
  onSync?: () => void;
  syncing?: boolean;
}

export default function MobileNav({
  activeTab,
  onOpenAchievements,
  onSync,
  syncing = false,
}: MobileNavProps) {
  return (
    <nav className="mobile-nav-bar">
      <a
        href="/"
        className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => soundFX.playClick()}
      >
        <span className="nav-icon">📋</span>
        <span className="nav-label">Dashboard</span>
      </a>

      <a
        href="/rewards"
        className={`mobile-nav-item ${activeTab === 'rewards' ? 'active' : ''}`}
        onClick={() => soundFX.playClick()}
      >
        <span className="nav-icon">🎁</span>
        <span className="nav-label">Recompensas</span>
      </a>

      {onOpenAchievements && (
        <button
          className="mobile-nav-item"
          onClick={() => { soundFX.playClick(); onOpenAchievements(); }}
        >
          <span className="nav-icon">🏅</span>
          <span className="nav-label">Logros</span>
        </button>
      )}

      {onSync && (
        <button
          className="mobile-nav-item"
          onClick={() => { soundFX.playClick(); onSync(); }}
          disabled={syncing}
        >
          <span className="nav-icon">{syncing ? '⌛' : '🔄'}</span>
          <span className="nav-label">{syncing ? 'Sincronizando' : 'Sincronizar'}</span>
        </button>
      )}
    </nav>
  );
}
