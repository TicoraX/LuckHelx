'use client';

import React from 'react';
import { getCs2Grade, type Cs2GradeInfo } from '@/lib/cs2-grade';

export type SkinBadgeSize = 'xs' | 'sm' | 'md' | 'lg';
export type SkinBadgeVariant = 'pill' | 'subtle' | 'text';

export interface SkinGradeBadgeProps {
  item?:
    | string
    | null
    | {
        rarityColor?: string | null;
        rarity_color?: string | null;
        rarity?: string | null;
        isRare?: boolean;
      };
  grade?: Cs2GradeInfo;
  size?: SkinBadgeSize;
  variant?: SkinBadgeVariant;
  showDot?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_STYLES: Record<
  SkinBadgeSize,
  { fontSize: string; padding: string; dotSize: string; gap: string }
> = {
  xs: { fontSize: '0.65rem', padding: '0.12rem 0.35rem', dotSize: '5px', gap: '0.25rem' },
  sm: { fontSize: '0.72rem', padding: '0.18rem 0.45rem', dotSize: '6px', gap: '0.35rem' },
  md: { fontSize: '0.8rem', padding: '0.22rem 0.55rem', dotSize: '7px', gap: '0.4rem' },
  lg: { fontSize: '0.9rem', padding: '0.3rem 0.75rem', dotSize: '8px', gap: '0.5rem' },
};

export default function SkinGradeBadge({
  item,
  grade: explicitGrade,
  size = 'sm',
  variant = 'pill',
  showDot = false,
  className = '',
  style = {},
}: SkinGradeBadgeProps) {
  const grade = explicitGrade ?? getCs2Grade(item);
  const sizeConfig = SIZE_STYLES[size];

  if (variant === 'text') {
    return (
      <span
        className={`skin-grade-text ${className}`}
        style={{
          color: grade.hex,
          fontWeight: 700,
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: sizeConfig.fontSize,
          display: 'inline-flex',
          alignItems: 'center',
          gap: sizeConfig.gap,
          letterSpacing: '-0.01em',
          ...style,
        }}
      >
        {showDot && (
          <span
            aria-hidden="true"
            style={{
              width: sizeConfig.dotSize,
              height: sizeConfig.dotSize,
              borderRadius: '50%',
              backgroundColor: grade.hex,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
        )}
        {grade.nameEs}
      </span>
    );
  }

  const isSubtle = variant === 'subtle';

  return (
    <span
      className={`skin-grade-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeConfig.gap,
        fontSize: sizeConfig.fontSize,
        padding: sizeConfig.padding,
        borderRadius: '4px',
        fontWeight: 700,
        fontFamily: 'var(--font-mono, monospace)',
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        backgroundColor: isSubtle
          ? `color-mix(in srgb, ${grade.hex} 10%, transparent)`
          : `color-mix(in srgb, ${grade.hex} 18%, rgba(15, 23, 42, 0.7))`,
        border: `1px solid color-mix(in srgb, ${grade.hex} 45%, transparent)`,
        color: grade.id === 'extraordinary' ? '#ffd700' : grade.hex,
        boxShadow:
          grade.id === 'extraordinary'
            ? '0 0 10px rgba(255, 215, 0, 0.25)'
            : 'none',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        ...style,
      }}
    >
      {showDot && (
        <span
          aria-hidden="true"
          style={{
            width: sizeConfig.dotSize,
            height: sizeConfig.dotSize,
            borderRadius: '50%',
            backgroundColor: grade.hex,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      )}
      {grade.id === 'extraordinary' ? '★ ' : ''}
      {grade.nameEs}
    </span>
  );
}

/**
 * Skeleton animado para tarjetas de skins mientras se cargan precios o inventario.
 */
export function SkinCardSkeleton({
  count = 1,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`inventory-card skin-card-skeleton ${className}`}
          style={{
            minHeight: '140px',
            opacity: 0.6,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            padding: '0.75rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <div
            style={{
              width: '100%',
              height: '75px',
              borderRadius: '4px',
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)',
              backgroundSize: '200% 100%',
              animation: 'skeleton-shimmer 1.8s infinite ease-in-out',
            }}
          />
          <div
            style={{
              width: '80%',
              height: '14px',
              borderRadius: '3px',
              background: 'rgba(255,255,255,0.08)',
              marginTop: 'auto',
            }}
          />
          <div
            style={{
              width: '45%',
              height: '11px',
              borderRadius: '3px',
              background: 'rgba(255,255,255,0.05)',
            }}
          />
        </div>
      ))}
    </>
  );
}
