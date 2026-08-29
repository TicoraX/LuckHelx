'use client';

import React, { useState, useEffect } from 'react';
import { IconClose } from './Icons';
import { soundFX } from '@/lib/sound';
import { formatXp } from '@/lib/xp';
import type { DailySpinResult } from '@/lib/daily-spin';

interface DailySpinModalProps {
  isOpen: boolean;
  canSpin: boolean;
  onClose: () => void;
  onSpinCompleted: () => void;
}

export default function DailySpinModal({
  isOpen,
  canSpin,
  onClose,
  onSpinCompleted,
}: DailySpinModalProps) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<DailySpinResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setError('');
      setSpinning(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSpin() {
    if (spinning || !canSpin) return;
    soundFX.playCaseUnlock();
    setSpinning(true);
    setError('');

    try {
      const res = await fetch('/api/daily-spin', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Error al girar ruleta');
        setSpinning(false);
        return;
      }

      // 2 seconds suspense spin
      setTimeout(() => {
        setResult(data);
        soundFX.playLevelUp();
        setSpinning(false);
        onSpinCompleted();
      }, 2000);
    } catch {
      setError('Error al procesar giro');
      setSpinning(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          textAlign: 'center',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', margin: 0 }}>🎰 Ruleta Diaria Gratuita</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.2rem',
            }}
            aria-label="Cerrar modal de ruleta diaria"
          >
            <IconClose size={20} />
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 1.5rem' }}>
          ¡Gira gratis una vez cada 24 horas para ganar XP, llaves o multiplicadores!
        </p>

        {/* Wheel Visual Graphic */}
        <div
          style={{
            margin: '0 auto 1.5rem',
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            border: '4px solid var(--accent-xp)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3rem',
            background: 'radial-gradient(circle, rgba(234,179,8,0.2) 0%, rgba(0,0,0,0.6) 100%)',
            boxShadow: spinning ? '0 0 30px var(--accent-xp)' : 'none',
            animation: spinning ? 'spin 0.4s linear infinite' : 'none',
          }}
        >
          {spinning ? '🌀' : result ? '🎁' : '🎯'}
        </div>

        {result && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 700 }}>
              ¡Premio Obtenido!
            </span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-xp)', margin: '0.3rem 0' }}>
              {result.label}
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              +{formatXp(result.xpAwarded)} XP acreditados en tu cuenta
            </span>
          </div>
        )}

        {error && (
          <p style={{ color: '#b3452f', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>
        )}

        {!result ? (
          <button
            className="btn"
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 700 }}
            onClick={handleSpin}
            disabled={spinning || !canSpin}
          >
            {spinning ? 'Girando ruleta...' : canSpin ? '¡Girar Ruleta Gratis!' : 'Ya giraste hoy (vuelve mañana)'}
          </button>
        ) : (
          <button className="btn" style={{ width: '100%', padding: '0.75rem' }} onClick={onClose}>
            ¡Genial! Aceptar
          </button>
        )}
      </div>
    </div>
  );
}
