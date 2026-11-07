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

// RARITY_LABEL usa una estrella para la legendaria: sirve en la tarjeta, pero un lector de pantalla
// no la dice. Donde la rareza se lee como texto se usa el nombre completo.
export function rarityName(rarity: string | null): string {
  const label: Record<string, string> = RARITY_LABEL;
  const key = rarity ?? 'common';
  return key === 'legendary' ? 'Legendaria' : (label[key] ?? label.common);
}

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
