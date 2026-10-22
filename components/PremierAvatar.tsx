'use client';

import { useMemo } from 'react';
import {
  calculatePremierRating,
  derivePremierStatsFromTasks,
  getPremierPerks,
  type PremierRatingProgress,
} from '@/lib/ranks';
import { IconMedal } from './Icons';

export interface PremierAvatarProps {
  rating?: number;
  progress?: PremierRatingProgress;
  tasks?: Array<{ completed_at: string | null; status: string }>;
  xpUnits?: number;
  dailyQuestsCompleted?: number;
  size?: number;
  showBadge?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function PremierAvatar({
  rating,
  progress: customProgress,
  tasks,
  xpUnits = 0,
  dailyQuestsCompleted = 0,
  size = 40,
  showBadge = true,
  onClick,
  className = '',
}: PremierAvatarProps) {
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

    return calculatePremierRating({
      weeklyCompletedTasks: 0,
      streakDays: 0,
    });
  }, [customProgress, tasks, xpUnits, dailyQuestsCompleted, rating]);

  const { tier, formattedRating } = currentProgress;
  const perks = useMemo(() => getPremierPerks(currentProgress.rating), [currentProgress.rating]);

  const borderWidth = Math.max(2, Math.round(size * 0.06));
  const medalSize = Math.max(12, Math.round(size * 0.35));

  const tooltip = `Premier Rating: ${formattedRating} pts (${tier.name}) • Bono XP: +${perks.xpBonusPercent}%${
    perks.hasShowcaseMedal ? ' • Medalla de Vitrina activa' : ''
  }`;

  return (
    <div
      role="img"
      className={`premier-avatar-container ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
    >
      {/* Outer Glow Ring & Avatar Frame */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: `${borderWidth}px solid ${tier.borderColor}`,
          boxShadow: `0 0 12px ${tier.glowColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-card, #111827)',
          overflow: 'hidden',
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        <span
          style={{
            fontSize: `${Math.round(size * 0.38)}px`,
            fontWeight: 800,
            fontFamily: 'var(--font-heading, sans-serif)',
            color: tier.color,
            letterSpacing: '0.02em',
          }}
        >
          {tier.tier}
        </span>
      </div>

      {/* Showcase Medal Badge on Tier 3+ */}
      {showBadge && perks.hasShowcaseMedal && (
        <div
          style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            width: `${medalSize}px`,
            height: `${medalSize}px`,
            borderRadius: '50%',
            background: tier.borderColor,
            boxShadow: `0 0 6px ${tier.glowColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            border: '1.5px solid var(--bg-card, #111827)',
          }}
          aria-hidden="true"
        >
          <IconMedal size={Math.round(medalSize * 0.7)} color="#ffffff" />
        </div>
      )}
    </div>
  );
}
