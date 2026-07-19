'use client';

import React from 'react';

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  max: number;
}

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  xpBalance: number;
  totalTasksCompleted: number;
  totalRewardsRedeemed: number;
}

export default function AchievementsModal({
  isOpen,
  onClose,
  xpBalance,
  totalTasksCompleted,
  totalRewardsRedeemed,
}: AchievementsModalProps) {
  if (!isOpen) return null;

  const achievements: Achievement[] = [
    {
      id: 'first_task',
      icon: '🎯',
      title: 'Primer Paso',
      description: 'Completa tu primera tarea',
      unlocked: totalTasksCompleted >= 1,
      progress: Math.min(1, totalTasksCompleted),
      max: 1,
    },
    {
      id: 'task_master',
      icon: '⚡',
      title: 'Máquina de Productividad',
      description: 'Completa 5 tareas',
      unlocked: totalTasksCompleted >= 5,
      progress: Math.min(5, totalTasksCompleted),
      max: 5,
    },
    {
      id: 'xp_hoarder',
      icon: '💎',
      title: 'Coleccionista de XP',
      description: 'Alcanza 300 Puntos de XP',
      unlocked: xpBalance >= 300,
      progress: Math.min(300, xpBalance),
      max: 300,
    },
    {
      id: 'treasure_hunter',
      icon: '📦',
      title: 'Cazador de Tesoros',
      description: 'Abre tu primer cofre o canjea un premio',
      unlocked: totalRewardsRedeemed >= 1,
      progress: Math.min(1, totalRewardsRedeemed),
      max: 1,
    },
    {
      id: 'shopaholic',
      icon: '🛒',
      title: 'Cliente Frecuente',
      description: 'Canjea 3 recompensas en total',
      unlocked: totalRewardsRedeemed >= 3,
      progress: Math.min(3, totalRewardsRedeemed),
      max: 3,
    },
  ];

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>🏅 Tus Logros</h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0', fontSize: '0.9rem' }}>
              Desbloqueados: {unlockedCount} / {achievements.length}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.2rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {achievements.map((ach) => (
            <div
              key={ach.id}
              style={{
                background: ach.unlocked ? 'rgba(168, 88, 62, 0.12)' : 'var(--bg)',
                border: `1px solid ${ach.unlocked ? 'var(--accent-primary)' : 'var(--border)'}`,
                borderRadius: '14px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                opacity: ach.unlocked ? 1 : 0.65,
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div
                style={{
                  fontSize: '2rem',
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: ach.unlocked ? 'rgba(168, 88, 62, 0.2)' : 'var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {ach.icon}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>{ach.title}</span>
                  {ach.unlocked ? (
                    <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.8rem' }}>✓ COMPLETADO</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {ach.progress} / {ach.max}
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem', fontSize: '0.85rem' }}>{ach.description}</p>
                <div className="xp-progress-bar" style={{ height: '5px' }}>
                  <div
                    className="xp-progress-fill"
                    style={{
                      width: `${(ach.progress / ach.max) * 100}%`,
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
