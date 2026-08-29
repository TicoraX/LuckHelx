'use client';

import React, { useState } from 'react';
import { IconTrophy, IconClose } from './Icons';
import { evaluateAchievements, type AchievementCategory } from '@/lib/achievements';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  xpBalance: number;
  totalTasksCompleted: number;
  totalRewardsRedeemed: number;
  currentStreak?: number;
}

const CATEGORY_TABS: { id: 'all' | AchievementCategory; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'tasks', label: 'Tareas' },
  { id: 'streaks', label: 'Rachas' },
  { id: 'economy', label: 'Economía' },
  { id: 'cs2', label: 'CS2' },
];

export default function AchievementsModal({
  isOpen,
  onClose,
  xpBalance,
  totalTasksCompleted,
  totalRewardsRedeemed,
  currentStreak = 1,
}: AchievementsModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | AchievementCategory>('all');

  if (!isOpen) return null;

  const allAchievements = evaluateAchievements({
    totalTasksCompleted,
    currentStreak,
    lifetimeXp: xpBalance,
    totalRewardsRedeemed,
  });

  const filteredAchievements = allAchievements.filter(
    (a) => selectedCategory === 'all' || a.category === selectedCategory
  );

  const unlockedCount = allAchievements.filter((a) => a.unlocked).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <IconTrophy size={24} color="var(--accent-xp)" />
            <div>
              <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Logros y Medallas</h2>
              <p style={{ color: 'var(--text-muted)', margin: '0.15rem 0 0', fontSize: '0.85rem' }}>
                Desbloqueados: {unlockedCount} / {allAchievements.length}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.2rem',
            }}
            aria-label="Cerrar modal de logros"
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              style={{
                fontSize: '0.78rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '4px',
                border: `1px solid ${selectedCategory === tab.id ? 'var(--accent-primary)' : 'var(--border)'}`,
                background: selectedCategory === tab.id ? 'var(--accent-primary)' : 'var(--bg-card)',
                color: selectedCategory === tab.id ? '#000' : 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: selectedCategory === tab.id ? 700 : 500,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {filteredAchievements.map((ach) => (
            <div
              key={ach.id}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${ach.unlocked ? 'var(--accent-primary)' : 'var(--border)'}`,
                borderRadius: '6px',
                padding: '0.85rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                opacity: ach.unlocked ? 1 : 0.6,
                transition: 'border-color 0.15s ease',
              }}
            >
              <div
                style={{
                  fontSize: '1.6rem',
                  width: '44px',
                  height: '44px',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {ach.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{ach.name}</span>
                  {ach.unlocked ? (
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      ✓ COMPLETADO
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      {ach.current} / {ach.target}
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 0.4rem', fontSize: '0.82rem' }}>{ach.description}</p>
                <div className="xp-progress-bar" style={{ height: '4px' }}>
                  <div
                    className="xp-progress-fill"
                    style={{
                      width: `${ach.progressPercent}%`,
                      background: ach.unlocked ? 'var(--accent-primary)' : 'var(--text-muted)',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
