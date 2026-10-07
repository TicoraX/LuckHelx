'use client';

import React, { useMemo } from 'react';
import {
  PremierRatingProgress,
  derivePremierStatsFromTasks,
  calculatePremierRating,
} from '@/lib/ranks';
import { soundFX } from '@/lib/sound';

export interface PremierRatingBadgeProps {
  /**
   * Valor de rating directo o progreso completo.
   */
  rating?: number;
  progress?: PremierRatingProgress;
  tasks?: Array<{ completed_at: string | null; status: string }>;
  xpUnits?: number;
  dailyQuestsCompleted?: number;
  /**
   * Modo compacto para el Header o barras superiores.
   */
  compact?: boolean;
  /**
   * Callback interactivo opcional al hacer click.
   */
  onClick?: () => void;
  /**
   * Si es true, reproduce sonido de promoción cuando se activa.
   */
  playSound?: boolean;
  className?: string;
}

export default function PremierRatingBadge({
  rating,
  progress: customProgress,
  tasks,
  xpUnits = 0,
  dailyQuestsCompleted = 0,
  compact = false,
  onClick,
  playSound = false,
  className = '',
}: PremierRatingBadgeProps) {
  const currentProgress = useMemo<PremierRatingProgress>(() => {
    if (customProgress) return customProgress;

    if (tasks && tasks.length > 0) {
      return derivePremierStatsFromTasks(tasks, xpUnits, new Date(), dailyQuestsCompleted);
    }

    if (typeof rating === 'number') {
      return calculatePremierRating({
        basePoints: rating,
        weeklyCompletedTasks: 0,
        streakDays: 0,
      });
    }

    // Default: Calibrating novice
    return calculatePremierRating({
      weeklyCompletedTasks: 0,
      streakDays: 0,
    });
  }, [customProgress, tasks, xpUnits, dailyQuestsCompleted, rating]);

  const {
    rating: effectiveRating,
    tier,
    nextTier,
    progressPercent,
    isDecayed,
    decayAmount,
    daysInactive,
    streakMultiplier,
    formattedRating,
  } = currentProgress;

  const handleClick = () => {
    if (playSound) {
      soundFX.playRankPromotionSound();
    }
    if (onClick) {
      onClick();
    }
  };

  const tooltipText = useMemo(() => {
    const parts = [
      `CS2 Premier Rating: ${formattedRating} pts`,
      `Banda: ${tier.name} (Tier ${tier.tier})`,
      `Multiplicador de Racha: ${streakMultiplier.toFixed(2)}x`,
    ];

    if (nextTier) {
      const ptsToNext = nextTier.minRating - effectiveRating;
      parts.push(`Faltan ${ptsToNext.toLocaleString('en-US')} pts para ${nextTier.name}`);
    } else {
      parts.push('Rango Máximo Mundial (30,000+ pts)');
    }

    if (isDecayed) {
      parts.push(`⚠️ Rank Decay activo: -${decayAmount.toLocaleString('en-US')} pts por inactividad (${daysInactive} días sin actividad)`);
    } else if (daysInactive === 2) {
      parts.push('⚠️ Advertencia: 48h de inactividad, en riesgo de Rank Decay mañana');
    }

    return parts.join(' • ');
  }, [formattedRating, tier, streakMultiplier, nextTier, effectiveRating, isDecayed, decayAmount, daysInactive]);

  if (compact) {
    return (
      <div
        className={`premier-rating-badge compact ${className}`}
        role="button"
        tabIndex={onClick ? 0 : undefined}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleClick();
          }
        }}
        title={tooltipText}
        aria-label={`Premier Rating ${formattedRating}, Banda ${tier.name}, progreso ${progressPercent}%`}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '2px',
          padding: '0.25rem 0.65rem',
          borderRadius: '4px',
          backgroundColor: 'var(--bg-card, #111827)',
          border: `1px solid ${tier.borderColor}`,
          boxShadow: `0 0 10px ${tier.glowColor}`,
          cursor: onClick ? 'pointer' : 'default',
          userSelect: 'none',
          position: 'relative',
          overflow: 'hidden',
          minWidth: '105px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: tier.color,
                boxShadow: `0 0 6px ${tier.color}`,
                display: 'inline-block',
              }}
              aria-hidden="true"
            />
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: tier.color,
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              {tier.name}
            </span>
          </div>

          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono, monospace)',
              color: '#ffffff',
              letterSpacing: '0.02em',
            }}
          >
            {formattedRating}
          </span>
        </div>

        {/* Progress Bar towards next tier */}
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso hacia ${nextTier?.name ?? 'Tier Máximo'}`}
          style={{
            width: '100%',
            height: '3px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
            marginTop: '2px',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: tier.color,
              boxShadow: `0 0 4px ${tier.color}`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`premier-rating-widget ${className}`}
      title={tooltipText}
      role="region"
      aria-label="Panel de CS2 Premier Rating"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        padding: '0.85rem 1.15rem',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-card, #111827)',
        border: `1px solid ${tier.borderColor}`,
        boxShadow: `0 4px 20px ${tier.glowColor}`,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              backgroundColor: tier.color,
              boxShadow: `0 0 10px ${tier.color}`,
              transform: 'rotate(45deg)',
            }}
            aria-hidden="true"
          />
          <div>
            <div
              style={{
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: tier.color,
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              PREMIER RATING • {tier.name}
            </div>
            <div
              style={{
                fontSize: '1.45rem',
                fontWeight: 900,
                fontFamily: 'var(--font-mono, monospace)',
                color: '#ffffff',
                lineHeight: 1.1,
                marginTop: '2px',
              }}
            >
              {formattedRating}
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginLeft: '4px' }}>
                PTS
              </span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--accent-xp, #38bdf8)',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            ⚡ {streakMultiplier.toFixed(2)}x racha
          </span>

          {isDecayed && (
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#ef4444',
                fontFamily: 'var(--font-mono, monospace)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              🔻 -{decayAmount} decay
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar towards Next Tier */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)' }}>
          <span>{tier.name} ({tier.minRating.toLocaleString('en-US')})</span>
          <span>
            {nextTier
              ? `${nextTier.name} (${nextTier.minRating.toLocaleString('en-US')})`
              : 'Global Elite (35,000+)'}
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso del ${progressPercent}% hacia el siguiente rango Premier`}
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: tier.color,
              boxShadow: `0 0 8px ${tier.color}`,
              transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
