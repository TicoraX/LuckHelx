'use client';

import React from 'react';
import { soundFX } from '@/lib/sound';
import { IconChest, IconDashboard, IconGift, IconLedger, IconTrophy, IconUpgrade } from './Icons';

interface MobileNavProps {
  activeTab: 'dashboard' | 'rewards' | 'inventory' | 'upgrade' | 'ledger';
  onOpenAchievements?: () => void;
}

export default function MobileNav({ activeTab, onOpenAchievements }: MobileNavProps) {
  return (
    <nav className="mobile-nav-bar">
      <a
        href="/"
        className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => soundFX.playClick()}
      >
        <span className="nav-icon">
          <IconDashboard size={19} />
        </span>
        <span className="nav-label">Dashboard</span>
      </a>

      <a
        href="/rewards"
        className={`mobile-nav-item ${activeTab === 'rewards' ? 'active' : ''}`}
        onClick={() => soundFX.playClick()}
      >
        <span className="nav-icon">
          <IconGift size={19} />
        </span>
        <span className="nav-label">Recompensas</span>
      </a>

      <a
        href="/inventory"
        className={`mobile-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
        onClick={() => soundFX.playClick()}
      >
        <span className="nav-icon">
          <IconChest size={19} />
        </span>
        <span className="nav-label">Inventario</span>
      </a>

      <a
        href="/upgrade"
        className={`mobile-nav-item ${activeTab === 'upgrade' ? 'active' : ''}`}
        onClick={() => soundFX.playClick()}
      >
        <span className="nav-icon">
          <IconUpgrade size={19} />
        </span>
        <span className="nav-label">Upgrade</span>
      </a>

      <a
        href="/ledger"
        className={`mobile-nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
        onClick={() => soundFX.playClick()}
      >
        <span className="nav-icon">
          <IconLedger size={19} />
        </span>
        <span className="nav-label">Estado</span>
      </a>

      {onOpenAchievements && (
        <button
          className="mobile-nav-item"
          onClick={() => {
            soundFX.playClick();
            onOpenAchievements();
          }}
        >
          <span className="nav-icon">
            <IconTrophy size={19} />
          </span>
          <span className="nav-label">Logros</span>
        </button>
      )}
    </nav>
  );
}
