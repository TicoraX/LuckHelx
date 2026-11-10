'use client';

import { useId } from 'react';
import {
  FEW_SKINS_MAX,
  formatPercent,
  type GridChest,
  tierAriaLabel,
  tierSegments,
} from '@/lib/chest-grid';
import type { Rarity, TierOdds } from '@/lib/rewards';
import { formatXp } from '@/lib/xp';

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Común',
  rare: 'Rara',
  epic: 'Épica',
  legendary: '★',
};

export function chestDisplayName(name: string): string {
  return name.replace(/^Caja: /, '');
}

interface ChestCardProps {
  chest: GridChest & { image: string | null };
  odds: TierOdds[];
  openCostUnits: number;
  keyUnits: number;
  xpBalance: number;
  itemCount: number;
  onOpen: () => void;
}

// La tarjeta entera abre el detalle y nunca abre la caja: hay cajas de 2.018 XP y el canje
// pasa siempre por el detalle y su confirmación.
export default function ChestCard({
  chest,
  odds,
  openCostUnits,
  keyUnits,
  xpBalance,
  itemCount,
  onOpen,
}: ChestCardProps) {
  const descId = useId();
  const name = chestDisplayName(chest.name);
  const segments = tierSegments(odds);
  const legendary = odds.find((o) => o.rarity === 'legendary');
  const missing = openCostUnits - xpBalance;

  return (
    <button
      type="button"
      className="chest-card"
      onClick={onOpen}
      aria-label={`${name}, ${formatXp(openCostUnits)} XP`}
      aria-describedby={descId}
    >
      <span className="chest-card-media">
        {chest.image && (
          <img src={chest.image} alt="" width={160} height={120} loading="lazy" decoding="async" />
        )}
        {itemCount <= FEW_SKINS_MAX && <span className="chest-card-flag">pocas skins</span>}
      </span>
      <span className="chest-card-name">{name}</span>
      <span className="chest-card-cost">{formatXp(openCostUnits)} XP</span>
      {keyUnits > 0 && (
        <span className="chest-card-breakdown">
          {formatXp(chest.xp_cost)} + {formatXp(keyUnits)} llave
        </span>
      )}
      {/* La descripción lleva lo que el aria-label del botón tapa: mezcla, ★ y saldo. */}
      <span id={descId} className="chest-card-desc">
        {segments.length > 0 && (
          <span className="tier-bar" role="img" aria-label={tierAriaLabel(odds, RARITY_LABEL)}>
            {segments.map((s) => (
              <span
                key={s.rarity}
                className="tier-bar-seg"
                style={{ width: `${s.widthPct}%`, background: `var(--rarity-${s.rarity})` }}
              />
            ))}
          </span>
        )}
        {(legendary || missing > 0) && (
          <span className="chest-card-foot">
            {legendary && (
              <span className="chest-card-star">★ {formatPercent(legendary.percent)}</span>
            )}
            {missing > 0 && <span className="chest-card-short">Faltan {formatXp(missing)} XP</span>}
          </span>
        )}
      </span>
    </button>
  );
}

export function ChestCardSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <div
            className="chest-card skeleton"
            aria-hidden="true"
            style={{
              pointerEvents: 'none',
              opacity: 0.65,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '1.1rem 0.9rem',
              gap: '0.6rem',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'var(--bg-card)',
            }}
          >
            <span
              style={{
                width: '100%',
                height: '110px',
                background: 'color-mix(in srgb, var(--border) 45%, transparent)',
                borderRadius: '4px',
                animation: 'pulse 1.8s ease-in-out infinite',
              }}
            />
            <span
              style={{
                width: '70%',
                height: '1.1rem',
                background: 'color-mix(in srgb, var(--border) 60%, transparent)',
                borderRadius: '4px',
                animation: 'pulse 1.8s ease-in-out infinite',
              }}
            />
            <span
              style={{
                width: '40%',
                height: '0.95rem',
                background: 'color-mix(in srgb, var(--border) 40%, transparent)',
                borderRadius: '4px',
                animation: 'pulse 1.8s ease-in-out infinite',
              }}
            />
          </div>
        </li>
      ))}
    </>
  );
}
