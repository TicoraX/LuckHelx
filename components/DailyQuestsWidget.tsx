'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { soundFX } from '@/lib/sound';
import { formatXp } from '@/lib/xp';
import type { QuestProgress } from '@/lib/quests';

interface DailyQuestsWidgetProps {
  onXpAwarded: () => void;
}

export default function DailyQuestsWidget({ onXpAwarded }: DailyQuestsWidgetProps) {
  const [quests, setQuests] = useState<QuestProgress[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadQuests = useCallback(async () => {
    try {
      const res = await fetch('/api/quests');
      if (res.ok) {
        const data = await res.json();
        setQuests(data.quests ?? []);
      }
    } catch {
      // silently ignore or retain current quests
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuests();
  }, [loadQuests]);

  async function handleClaim(quest: QuestProgress) {
    if (claimingId || !quest.completed || quest.claimed) return;
    soundFX.playClick();
    setClaimingId(quest.id);
    try {
      const res = await fetch('/api/quests/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId: quest.id }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        soundFX.playLevelUp();
        await loadQuests();
        onXpAwarded();
      }
    } catch {
      // error handled
    } finally {
      setClaimingId(null);
    }
  }

  if (loading || quests.length === 0) return null;

  const completedUnclaimed = quests.filter((q) => q.completed && !q.claimed).length;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '1.1rem 1.25rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700 }}>Misiones Diarias & Semanales</h3>
            {completedUnclaimed > 0 && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '3px',
                  background: 'var(--accent-xp)',
                  color: '#000',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {completedUnclaimed} por reclamar
              </span>
            )}
          </div>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Completa objetivos para ganar bonus directo de XP.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {quests.map((q) => {
          const progressPercent = Math.min(100, Math.floor((q.progress / q.target) * 100));

          return (
            <div
              key={q.id}
              style={{
                background: 'rgba(0,0,0,0.15)',
                border: `1px solid ${q.claimed ? 'var(--border)' : q.completed ? 'var(--accent-primary)' : 'var(--border)'}`,
                borderRadius: '4px',
                padding: '0.75rem 0.9rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.5rem',
                opacity: q.claimed ? 0.6 : 1,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font-mono)',
                      color: q.type === 'weekly' ? 'var(--accent-xp)' : 'var(--accent-primary)',
                      fontWeight: 700,
                    }}
                  >
                    {q.type === 'weekly' ? 'Semanal' : 'Diaria'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent-xp)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    +{formatXp(q.bonusXp)} XP
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{q.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{q.description}</div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontFamily: 'var(--font-mono)' }}>
                  <span>Progreso</span>
                  <span>{q.progress} / {q.target}</span>
                </div>
                <div className="xp-progress-bar" style={{ height: '4px', marginBottom: '0.6rem' }}>
                  <div
                    className="xp-progress-fill"
                    style={{
                      width: `${progressPercent}%`,
                      background: q.claimed ? 'var(--text-muted)' : q.completed ? 'var(--accent-primary)' : 'var(--accent-xp)',
                    }}
                  />
                </div>

                {q.claimed ? (
                  <button
                    className="btn-action"
                    disabled
                    style={{ width: '100%', padding: '0.3rem', fontSize: '0.78rem', opacity: 0.5 }}
                  >
                    ✓ Reclamado
                  </button>
                ) : q.completed ? (
                  <button
                    className="btn-action"
                    onClick={() => handleClaim(q)}
                    disabled={claimingId === q.id}
                    style={{
                      width: '100%',
                      padding: '0.3rem',
                      fontSize: '0.78rem',
                      background: 'var(--accent-primary)',
                      color: '#000',
                      fontWeight: 700,
                    }}
                  >
                    {claimingId === q.id ? 'Reclamando...' : '¡Reclamar Bonus!'}
                  </button>
                ) : (
                  <button
                    className="btn-action"
                    disabled
                    style={{ width: '100%', padding: '0.3rem', fontSize: '0.78rem', opacity: 0.6 }}
                  >
                    En progreso ({progressPercent}%)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
