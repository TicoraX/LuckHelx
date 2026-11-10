'use client';

import {
  CS2_WEAR_TIERS,
  formatFloat,
  getWearInfo,
} from '@/lib/cs2-wear';

interface FloatBarProps {
  float: number | null | undefined;
  showBadge?: boolean;
  showLabels?: boolean;
  compact?: boolean;
}

export default function FloatBar({
  float,
  showBadge = true,
  showLabels = false,
  compact = false,
}: FloatBarProps) {
  if (typeof float !== 'number' || Number.isNaN(float) || float < 0 || float > 1) {
    return null;
  }

  const wear = getWearInfo(float);
  if (!wear) return null;

  const percentage = Math.min(100, Math.max(0, float * 100));

  return (
    <div
      className="cs2-float-container"
      style={{
        width: '100%',
        margin: compact ? '0.35rem 0' : '0.6rem 0',
      }}
      role="meter"
      aria-label={`Desgaste ${wear.name}, float ${formatFloat(float, 4)}`}
      aria-valuenow={float}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuetext={`${wear.shortName} (${wear.name})`}
    >
      {/* Header Info: Badge & Float Value */}
      {showBadge && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.35rem',
            fontSize: compact ? '0.72rem' : '0.8rem',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '0.12rem 0.4rem',
                borderRadius: '3px',
                background: `color-mix(in srgb, ${wear.color} 20%, transparent)`,
                border: `1px solid ${wear.color}`,
                color: wear.color,
                fontWeight: 700,
                fontSize: '0.72rem',
                letterSpacing: '0.04em',
              }}
            >
              {wear.shortName}
            </span>
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{wear.name}</span>
          </div>
          <span
            style={{
              color: 'var(--text-muted)',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {formatFloat(float, 4)}
          </span>
        </div>
      )}

      {/* The 5-zone Track */}
      <div
        style={{
          position: 'relative',
          height: compact ? '5px' : '7px',
          width: '100%',
          display: 'flex',
          borderRadius: '4px',
          overflow: 'visible',
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid var(--border)',
        }}
      >
        {/* FN: 7% */}
        <div
          style={{
            width: '7%',
            height: '100%',
            background: CS2_WEAR_TIERS[0].color,
            borderTopLeftRadius: '3px',
            borderBottomLeftRadius: '3px',
          }}
          title="Factory New (0.00 - 0.07)"
        />
        {/* MW: 8% */}
        <div
          style={{
            width: '8%',
            height: '100%',
            background: CS2_WEAR_TIERS[1].color,
          }}
          title="Minimal Wear (0.07 - 0.15)"
        />
        {/* FT: 23% */}
        <div
          style={{
            width: '23%',
            height: '100%',
            background: CS2_WEAR_TIERS[2].color,
          }}
          title="Field-Tested (0.15 - 0.38)"
        />
        {/* WW: 7% */}
        <div
          style={{
            width: '7%',
            height: '100%',
            background: CS2_WEAR_TIERS[3].color,
          }}
          title="Well-Worn (0.38 - 0.45)"
        />
        {/* BS: 55% */}
        <div
          style={{
            width: '55%',
            height: '100%',
            background: CS2_WEAR_TIERS[4].color,
            borderTopRightRadius: '3px',
            borderBottomRightRadius: '3px',
          }}
          title="Battle-Scarred (0.45 - 1.00)"
        />

        {/* Needle Indicator */}
        <div
          style={{
            position: 'absolute',
            left: `${percentage}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: compact ? '4px' : '5px',
            height: compact ? '13px' : '16px',
            background: '#ffffff',
            borderRadius: '2px',
            boxShadow: '0 0 5px rgba(0,0,0,0.9), 0 0 2px #fff',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Segment Labels if requested */}
      {showLabels && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono, monospace)',
            marginTop: '0.25rem',
          }}
        >
          <span>0.00 FN</span>
          <span>0.07</span>
          <span>0.15 FT</span>
          <span>0.38</span>
          <span>0.45 BS 1.00</span>
        </div>
      )}
    </div>
  );
}
