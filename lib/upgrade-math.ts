import { getDeterministicSkinPrice } from './skin-prices';

// Logica pura del Upgrade, segura para el navegador: sin crypto ni base de datos.
// lib/upgrade.ts la reexporta.

export type SectorMode = 'under' | 'over';
export type UpgradeOutcome = 'won' | 'lost';

export const UPGRADE_MIN_PROBABILITY = 0.0001; // 0.01%
export const UPGRADE_MAX_PROBABILITY = 0.95; // 95%
export const UPGRADE_DEFAULT_EDGE = 0.05; // 5%
export const UPGRADE_MIN_MULT = 1.1; // piso de la lista: a x1,05 el clamp del 95% quita la decision
export const UPGRADE_MAX_LIST_MULT = 20;
export const UPGRADE_MAX_SERVER_MULT = 100; // tope duro de executeUpgrade
export const UPGRADE_LIST_LIMIT = 48;
export const UPGRADE_MULTIPLIERS = [1.5, 2, 5, 10, 20] as const;

/** Valoracion unica de una skin en centavos: precio real si es > 0, si no el determinista. */
export function valueCentsOf(
  usd: number | null | undefined,
  name: string,
  rarity: string | null
): number {
  const price =
    usd !== null && usd !== undefined && usd > 0 ? usd : getDeterministicSkinPrice(name, rarity);
  return Math.max(1, Math.round(price * 100));
}

export interface UpgradeCalculation {
  inputValueCents: number;
  targetValueCents: number;
  edgeRate: number;
  rawProbability: number;
  probability: number;
  winPercentage: number;
  sectorMode: SectorMode;
  sectorStartAngle: number;
  sectorEndAngle: number;
  sectorSpanAngle: number;
  multiplier: number;
}

/**
 * Cálculo matemático del Upgrade con House Edge y clamping estricto [0.01%, 95%].
 */
export function calculateUpgradeOdds(
  inputValueCents: number,
  targetValueCents: number,
  edgeRate: number = UPGRADE_DEFAULT_EDGE,
  mode: SectorMode = 'under'
): UpgradeCalculation {
  if (targetValueCents <= 0) {
    throw new Error('targetValueCents debe ser mayor a 0');
  }
  if (inputValueCents <= 0) {
    throw new Error('inputValueCents debe ser mayor a 0');
  }

  const safeEdge = Math.max(0, Math.min(0.2, edgeRate));
  const rawProb = inputValueCents / (targetValueCents * (1 + safeEdge));
  const probability = Math.min(UPGRADE_MAX_PROBABILITY, Math.max(UPGRADE_MIN_PROBABILITY, rawProb));

  const winPercentage = Math.round(probability * 10000) / 100;
  const sectorSpanAngle = Math.round(probability * 360 * 100) / 100;

  let sectorStartAngle = 0;
  let sectorEndAngle = sectorSpanAngle;

  if (mode === 'over') {
    sectorStartAngle = Math.round((360 - sectorSpanAngle) * 100) / 100;
    sectorEndAngle = 360;
  }

  const multiplier = Math.round((targetValueCents / inputValueCents) * 100) / 100;

  return {
    inputValueCents,
    targetValueCents,
    edgeRate: safeEdge,
    rawProbability: rawProb,
    probability,
    winPercentage,
    sectorMode: mode,
    sectorStartAngle,
    sectorEndAngle,
    sectorSpanAngle,
    multiplier,
  };
}

export interface UpgradeTargetCatalogItem {
  id: string;
  name: string;
  rarity: string | null;
  rarityColor?: string | null;
  image: string | null;
  priceUsd: number;
  valueCents: number;
  priceIsFallback: boolean;
}

export interface UpgradeTargetList {
  items: UpgradeTargetCatalogItem[];
  total: number;
  maxValueCents: number;
  /** Claves "1.5", "2", "5", "10", "20": el mas cercano a entrada x m sobre todo el rango. */
  byMultiplier: Record<string, UpgradeTargetCatalogItem | null>;
}

/** El objetivo de valor mas cercano a goalCents; en empate, el de menor valor. */
export function nearestTarget(
  items: UpgradeTargetCatalogItem[],
  goalCents: number
): UpgradeTargetCatalogItem | null {
  let best: UpgradeTargetCatalogItem | null = null;
  for (const it of items) {
    if (!best) {
      best = it;
      continue;
    }
    const d = Math.abs(it.valueCents - goalCents);
    const bd = Math.abs(best.valueCents - goalCents);
    if (d < bd || (d === bd && it.valueCents < best.valueCents)) best = it;
  }
  return best;
}

/** "14,32" o "1.750,00": centavos como dolares con coma decimal y punto de miles. */
export function formatUsdCents(cents: number): string {
  const whole = Math.floor(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${whole},${String(cents % 100).padStart(2, '0')}`;
}

/** Multiplicador con un decimal y coma: 2 -> "2", 4.1 -> "4,1". */
export function formatMultiplier(m: number): string {
  return (Math.round(m * 10) / 10).toString().replace('.', ',');
}

/** Porcentaje con un decimal y coma: 47.62 -> "47,6" (sin el signo %). */
export function formatPercent(pct: number): string {
  return pct.toFixed(1).replace('.', ',');
}
