'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { IconLedger, IconLightning } from './Icons';
import PomodoroWidget from './PomodoroWidget';
import PremierAvatar from './PremierAvatar';
import PremierRatingBadge from './PremierRatingBadge';
import SoundToggle from './SoundToggle';
import ThemeToggle from './ThemeToggle';
import { formatXp } from '@/lib/xp';

export interface HeaderProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  xpBalance?: number;
  tasks?: Array<{ completed_at: string | null; status: string }>;
}

export default function Header({ left, right, children, xpBalance, tasks }: HeaderProps) {
  const [balance, setBalance] = useState<number>(xpBalance ?? 0);
  const [tasksList, setTasksList] = useState<
    Array<{ completed_at: string | null; status: string }>
  >(tasks ?? []);

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

  return (
    <header className="app-header">
      {/* Nivel 1: Identidad, Rango Premier y Utilidades del Sistema */}
      <div className="header-top-bar">
        <div className="header-identity">
          <a href="/" className="header-brand">
            <div className="brand-icon">
              <IconLedger size={20} color="#ffffff" />
            </div>
            <span className="brand-title">
              LuckHelx<span style={{ color: 'var(--accent-primary)' }}>.</span>
            </span>
          </a>

          {/* Dynamic Premier Avatar with CS2 Tier Ring */}
          <PremierAvatar size={32} tasks={tasksList} xpUnits={balance} />

          {/* CS2 Premier Rating Badge */}
          <PremierRatingBadge compact tasks={tasksList} xpUnits={balance} />

          {left}
        </div>

        <div className="header-system-controls">
          {/* Saldo de XP global persistente */}
          <div className="header-xp-pill" title="Saldo de XP acumulado">
            <IconLightning size={14} color="var(--accent-xp)" />
            <span className="mono-value">{formatXp(balance)} XP</span>
          </div>

          {right}

          <PomodoroWidget />
          <SoundToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Nivel 2: Barra de Pestañas de Navegación de Vistas (CS2 Hub Tabs) */}
      {children && (
        <nav className="header-nav-bar" aria-label="Navegación principal">
          {children}
        </nav>
      )}
    </header>
  );
}
