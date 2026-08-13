'use client';

import React from 'react';
import { IconTrophy, IconClose, IconCheck, IconLightning, IconSparkles, IconChest, IconGift } from './Icons';
import { toXpUnits } from '@/lib/xp';

const XP_HOARDER_UNITS = toXpUnits(300);

export interface Achievement {
  id: string;
  icon: React.ReactNode;
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
      icon: <IconCheck size={22} />,
      title: 'Primer Paso',
      description: 'Completa tu primera tarea',
      unlocked: totalTasksCompleted >= 1,
      progress: Math.min(1, totalTasksCompleted),
      max: 1,
    },
    {
      id: 'task_master',
      icon: <IconLightning size={22} />,
      title: 'Máquina de Productividad',
      description: 'Completa 5 tareas',
      unlocked: totalTasksCompleted >= 5,
      progress: Math.min(5, totalTasksCompleted),
      max: 5,
    },
    {
      id: 'xp_hoarder',
      icon: <IconSparkles size={22} />,
      title: 'Coleccionista de XP',
      description: 'Alcanza 300 Puntos de XP',
      // El umbral sigue siendo 300 XP; lo que cambió es la unidad del saldo.
      unlocked: xpBalance >= XP_HOARDER_UNITS,
      progress: Math.min(XP_HOARDER_UNITS, xpBalance),
      max: XP_HOARDER_UNITS,
    },
    {
      id: 'treasure_hunter',
      icon: <IconChest size={22} />,
      title: 'Cazador de Tesoros',
      description: 'Abre tu primer cofre o canjea un premio',
      unlocked: totalRewardsRedeemed >= 1,
      progress: Math.min(1, totalRewardsRedeemed),
      max: 1,
    },
    {
      id: 'shopaholic',
      icon: <IconGift size={22} />,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <IconTrophy size={22} color="var(--accent-xp)" />
            <div>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Tus Logros</h2>
              <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0', fontSize: '0.9rem' }}>
                Desbloqueados: {unlockedCount} / {achievements.length}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {achievements.map((ach) => (
            <div
              key={ach.id}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${ach.unlocked ? 'var(--accent-primary)' : 'var(--border)'}`,
                borderRadius: '6px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                opacity: ach.unlocked ? 1 : 0.65,
                transition: 'border-color 0.15s ease',
              }}
            >
              <div
                style={{
                  fontSize: '2rem',
                  width: '48px',
                  height: '48px',
                  borderRadius: '4px',
                  background: 'var(--border)',
                  color: ach.unlocked ? 'var(--accent-primary)' : 'var(--text-muted)',
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
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>✓ COMPLETADO</span>
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
