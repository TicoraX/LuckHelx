'use client';

import { useEffect, useRef, useState } from 'react';
import type { DailySpinResult } from '@/lib/daily-spin';
import { soundFX } from '@/lib/sound';
import { formatXp } from '@/lib/xp';
import { IconClose, IconDice } from './Icons';
import Modal from './Modal';

interface DailySpinModalProps {
  isOpen: boolean;
  canSpin: boolean;
  onClose: () => void;
  onSpinCompleted: () => void;
}

interface WheelSegment {
  type: DailySpinResult['rewardType'];
  label: string;
  sublabel: string;
  color: string;
  textColor: string;
}

const WHEEL_SEGMENTS: WheelSegment[] = [
  { type: 'xp_small', label: '1.50 XP', sublabel: 'Caja', color: '#2d3748', textColor: '#e2e8f0' },
  { type: 'xp_medium', label: '3.50 XP', sublabel: 'XP', color: '#1e3a8a', textColor: '#93c5fd' },
  { type: 'xp_small', label: '1.50 XP', sublabel: 'Caja', color: '#2d3748', textColor: '#e2e8f0' },
  { type: 'free_key', label: 'Llave', sublabel: 'CS2', color: '#6b21a8', textColor: '#f3e8ff' },
  { type: 'xp_small', label: '1.50 XP', sublabel: 'Caja', color: '#2d3748', textColor: '#e2e8f0' },
  { type: 'xp_medium', label: '3.50 XP', sublabel: 'XP', color: '#1e3a8a', textColor: '#93c5fd' },
  { type: 'xp_small', label: '1.50 XP', sublabel: 'Caja', color: '#2d3748', textColor: '#e2e8f0' },
  { type: 'jackpot', label: '15.00 XP', sublabel: 'JACKPOT', color: '#b45309', textColor: '#fef08a' },
];

const SEGMENT_COUNT = WHEEL_SEGMENTS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT; // 45 deg

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  // 0 grados = arriba (12 en punto). Ángulos crecen en sentido horario.
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${x} ${y} L ${end.x} ${end.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${start.x} ${start.y} Z`;
}

export default function DailySpinModal({
  isOpen,
  canSpin,
  onClose,
  onSpinCompleted,
}: DailySpinModalProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [result, setResult] = useState<DailySpinResult | null>(null);
  const [error, setError] = useState('');
  const tickAudioTimerRef = useRef<NodeJS.Timeout[]>([]);

  // Limpieza al desmontar el componente
  useEffect(() => {
    return () => {
      tickAudioTimerRef.current.forEach(clearTimeout);
      tickAudioTimerRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setError('');
      setSpinning(false);
      setRotationAngle(0);
      tickAudioTimerRef.current.forEach(clearTimeout);
      tickAudioTimerRef.current = [];
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSpin() {
    if (spinning || !canSpin) return;
    setSpinning(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/daily-spin', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Error al girar ruleta');
        setSpinning(false);
        return;
      }

      // Buscar todos los sectores que coinciden con el premio
      const matchingIndices = WHEEL_SEGMENTS.map((seg, idx) => (seg.type === data.rewardType ? idx : -1)).filter(
        (idx) => idx !== -1
      );
      const chosenSegmentIndex = matchingIndices[Math.floor(Math.random() * matchingIndices.length)];

      // Calcular ángulo central del sector
      const segmentCenterAngle = chosenSegmentIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
      // Pequeño jitter aleatorio para no caer siempre en el centro exacto (+-10 grados)
      const jitter = (Math.random() - 0.5) * 20;

      // Giros completos (5 vueltas completas = 1800 deg)
      const fullRotations = 5 * 360;
      const targetAngle = fullRotations + (360 - segmentCenterAngle) + jitter;

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReduced) {
        setRotationAngle(targetAngle);
        setResult(data);
        soundFX.playLevelUp();
        setSpinning(false);
        onSpinCompleted();
        return;
      }

      // Sonido de inicio de giro
      soundFX.playCaseUnlock();

      // Programar ticks de audio durante el frenado
      tickAudioTimerRef.current.forEach(clearTimeout);
      tickAudioTimerRef.current = [];
      const tickTimestamps = [
        100, 250, 400, 600, 800, 1050, 1300, 1600, 1950, 2350, 2800, 3300, 3750, 4100,
      ];
      tickTimestamps.forEach((ms) => {
        const timer = setTimeout(() => {
          soundFX.playClick();
        }, ms);
        tickAudioTimerRef.current.push(timer);
      });

      // Disparar la animación de giro
      setRotationAngle(targetAngle);

      // Esperar 4.3s a que termine la animación
      const doneTimer = setTimeout(() => {
        setResult(data);
        if (data.rewardType === 'jackpot') {
          soundFX.playRankPromotionSound();
        } else {
          soundFX.playLevelUp();
        }
        setSpinning(false);
        onSpinCompleted();
      }, 4300);
      tickAudioTimerRef.current.push(doneTimer);
    } catch {
      setError('Error al procesar giro');
      setSpinning(false);
    }
  }

  return (
    <Modal onClose={spinning ? () => {} : onClose}>
      <div
        className="modal-dialog"
        style={{
          maxWidth: '440px',
          width: '95vw',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          textAlign: 'center',
          padding: '1.5rem',
          position: 'relative',
        }}
        role="dialog"
        aria-labelledby="daily-spin-title"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h2
            id="daily-spin-title"
            style={{
              fontSize: '1.25rem',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 700,
            }}
          >
            <IconDice size={22} color="var(--accent-xp)" /> Ruleta Diaria
          </h2>
          {!spinning && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.4rem',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Cerrar modal de ruleta diaria"
            >
              <IconClose size={20} />
            </button>
          )}
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
          Gira gratis cada 24 horas para ganar XP y llaves oficiales de CS2.
        </p>

        {/* Ruleta Wheel Visual Graphic */}
        <div
          style={{
            position: 'relative',
            width: '260px',
            height: '260px',
            margin: '0 auto 1.25rem',
          }}
        >
          {/* Puntero indicador arriba (12 en punto) */}
          <div
            style={{
              position: 'absolute',
              top: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
            }}
            aria-hidden="true"
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <polygon points="4,2 20,2 12,20" fill="var(--accent-xp)" stroke="#000" strokeWidth="2" />
            </svg>
          </div>

          {/* Rueda giratoria SVG */}
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              boxShadow: spinning
                ? '0 0 25px rgba(234, 179, 8, 0.4), 0 0 50px rgba(0,0,0,0.8)'
                : '0 4px 20px rgba(0,0,0,0.4)',
              transform: `rotate(${rotationAngle}deg)`,
              transition: spinning ? 'transform 4.2s cubic-bezier(0.12, 0.8, 0.2, 1)' : 'none',
              overflow: 'hidden',
            }}
          >
            <svg width="260" height="260" viewBox="0 0 260 260" style={{ display: 'block' }}>
              <defs>
                <radialGradient id="wheel-center-gradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </radialGradient>
              </defs>

              {/* Borde exterior */}
              <circle cx="130" cy="130" r="128" fill="#0f172a" stroke="var(--border)" strokeWidth="4" />

              {/* Sectores */}
              {WHEEL_SEGMENTS.map((seg, idx) => {
                const startAngle = idx * SEGMENT_ANGLE;
                const endAngle = (idx + 1) * SEGMENT_ANGLE;
                const midAngle = startAngle + SEGMENT_ANGLE / 2;
                const pathData = describeArc(130, 130, 124, startAngle, endAngle);

                return (
                  <g key={idx}>
                    <path
                      d={pathData}
                      fill={seg.color}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                    {/* Texto del premio orientado hacia afuera */}
                    <g transform={`rotate(${midAngle}, 130, 130)`}>
                      <text
                        x="130"
                        y="34"
                        fill={seg.textColor}
                        fontSize="10"
                        fontWeight="800"
                        fontFamily="var(--font-mono, monospace)"
                        textAnchor="middle"
                        letterSpacing="-0.02em"
                      >
                        {seg.label}
                      </text>
                      <text
                        x="130"
                        y="46"
                        fill="rgba(255,255,255,0.7)"
                        fontSize="8"
                        fontWeight="600"
                        fontFamily="var(--font-mono, monospace)"
                        textAnchor="middle"
                      >
                        {seg.sublabel}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Centro de la rueda */}
              <circle
                cx="130"
                cy="130"
                r="28"
                fill="url(#wheel-center-gradient)"
                stroke="var(--accent-xp)"
                strokeWidth="3"
              />
              <circle cx="130" cy="130" r="6" fill="var(--accent-xp)" />
            </svg>
          </div>
        </div>

        {/* Resultado tras el giro */}
        {result && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '6px',
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem',
            }}
          >
            <span
              style={{
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                color: 'var(--accent-primary)',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              ¡Premio Obtenido!
            </span>
            <div
              style={{
                fontSize: '1.3rem',
                fontWeight: 800,
                color: 'var(--accent-xp)',
                margin: '0.2rem 0',
              }}
            >
              {result.label}
            </div>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              +{formatXp(result.xpAwarded)} XP acreditados en tu cuenta
            </span>
          </div>
        )}

        {error && (
          <p role="alert" style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        {!result ? (
          <button
            type="button"
            className="btn"
            style={{
              width: '100%',
              padding: '0.8rem',
              fontSize: '1rem',
              fontWeight: 700,
              background: canSpin && !spinning ? 'var(--accent-xp)' : 'var(--bg)',
              color: canSpin && !spinning ? '#000' : 'var(--text-muted)',
              cursor: canSpin && !spinning ? 'pointer' : 'not-allowed',
            }}
            onClick={handleSpin}
            disabled={spinning || !canSpin}
          >
            {spinning
              ? 'Girando ruleta...'
              : canSpin
                ? '¡Girar Ruleta Gratis!'
                : 'Ya giraste hoy (vuelve mañana)'}
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            style={{
              width: '100%',
              padding: '0.8rem',
              fontWeight: 700,
              background: 'var(--accent-primary)',
              color: '#000',
            }}
            onClick={onClose}
          >
            ¡Genial! Aceptar
          </button>
        )}
      </div>
    </Modal>
  );
}
