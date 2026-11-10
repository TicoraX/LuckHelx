/**
 * lib/cs2-float.ts - Lógica matemática canónica de desgaste (Float) de Counter-Strike 2.
 * Define los 5 rangos oficiales de Valve, cálculo determinista de float y fórmula de Trade-Up.
 */

import floatRangesRaw from './cs2-float-ranges.json';

const FLOAT_RANGES: Record<string, [number, number]> = floatRangesRaw as unknown as Record<
  string,
  [number, number]
>;

export type Cs2WearTier = 'FN' | 'MW' | 'FT' | 'WW' | 'BS';

export interface Cs2WearInfo {
  tier: Cs2WearTier;
  shortName: string;
  name: string;
  nameEn: string;
  min: number;
  max: number;
  color: string;
}

export const CS2_WEAR_TIERS: readonly Cs2WearInfo[] = [
  {
    tier: 'FN',
    shortName: 'FN',
    name: 'Recién Fabricado',
    nameEn: 'Factory New',
    min: 0.0,
    max: 0.07,
    color: '#10b981', // Verde esmeralda
  },
  {
    tier: 'MW',
    shortName: 'MW',
    name: 'Casi Nuevo',
    nameEn: 'Minimal Wear',
    min: 0.07,
    max: 0.15,
    color: '#06b6d4', // Cyan
  },
  {
    tier: 'FT',
    shortName: 'FT',
    name: 'Algo Desgastado',
    nameEn: 'Field-Tested',
    min: 0.15,
    max: 0.38,
    color: '#eab308', // Ámbar / Amarillo
  },
  {
    tier: 'WW',
    shortName: 'WW',
    name: 'Bastante Desgastado',
    nameEn: 'Well-Worn',
    min: 0.38,
    max: 0.45,
    color: '#f97316', // Naranja
  },
  {
    tier: 'BS',
    shortName: 'BS',
    name: 'Deplorable',
    nameEn: 'Battle-Scarred',
    min: 0.45,
    max: 1.0,
    color: '#ef4444', // Rojo
  },
] as const;

/**
 * Obtiene la información del tier de desgaste para un float dado.
 * Retorna null si el float es null, undefined o NaN (skins vanilla o canjes históricos).
 */
export function getWearInfo(float: number | null | undefined): Cs2WearInfo | null {
  if (typeof float !== 'number' || Number.isNaN(float) || float < 0 || float > 1) {
    return null;
  }
  if (float < 0.07) return CS2_WEAR_TIERS[0];
  if (float < 0.15) return CS2_WEAR_TIERS[1];
  if (float < 0.38) return CS2_WEAR_TIERS[2];
  if (float < 0.45) return CS2_WEAR_TIERS[3];
  return CS2_WEAR_TIERS[4];
}

/**
 * Formatea un valor float numérico a N decimales (default 4).
 * Ejemplo: 0.034185 -> "0.0342"
 */
export function formatFloat(float: number | null | undefined, digits: number = 4): string {
  if (typeof float !== 'number' || Number.isNaN(float)) return '';
  return float.toFixed(digits);
}

/**
 * Obtiene el rango de float [min, max] oficial de Valve para una skin dada su nombre.
 * Soporta variantes con o sin estrella de cuchillo (★).
 */
export function getSkinFloatRange(
  name: string
): { minFloat: number; maxFloat: number } | null {
  if (!name) return null;
  const range = FLOAT_RANGES[name] ?? FLOAT_RANGES[name.replace(/^★\s*/, '')];
  if (!range) return null;
  return { minFloat: range[0], maxFloat: range[1] };
}

/**
 * Sortea un float de CS2 para una skin dada por su nombre de catálogo.
 * Si la skin no tiene desgaste oficial (cuchillo vanilla, sticker, pin, etc.), retorna null.
 */
export function rollFloatForSkin(
  skinName: string,
  rng: () => number = Math.random
): number | null {
  const range = getSkinFloatRange(skinName);
  if (!range) return null;
  return rollSkinFloat(range.minFloat, range.maxFloat, rng);
}

/**
 * Sortea un float de manera uniforme en el rango [minFloat, maxFloat].
 * Si los límites son nulos o inválidos (ej. cuchillo vanilla), retorna null.
 */
export function rollSkinFloat(
  minFloat?: number | null,
  maxFloat?: number | null,
  rng: () => number = Math.random
): number | null {
  if (typeof minFloat !== 'number' || typeof maxFloat !== 'number') {
    return null;
  }
  const min = Math.max(0, Math.min(minFloat, maxFloat));
  const max = Math.min(1, Math.max(minFloat, maxFloat));
  if (min === max) return min;

  const r = rng();
  // Clampeado seguro a 6 decimales para evitar desbordes de coma flotante
  const val = min + r * (max - min);
  return Math.max(min, Math.min(max, Math.round(val * 1000000) / 1000000));
}

export interface TradeUpFloatInputItem {
  float: number;
  minFloat?: number | null;
  maxFloat?: number | null;
}

/**
 * Calcula el float resultante de un Contrato Trade-Up utilizando la fórmula oficial de Valve:
 * float_out = min_out + avg((float_i - min_i) / (max_i - min_i)) * (max_out - min_out)
 */
export function calculateTradeUpFloat(
  inputs: TradeUpFloatInputItem[],
  targetMinFloat?: number | null,
  targetMaxFloat?: number | null
): number | null {
  if (!inputs || inputs.length === 0) return null;
  const targetMin = typeof targetMinFloat === 'number' ? Math.max(0, targetMinFloat) : 0.0;
  const targetMax = typeof targetMaxFloat === 'number' ? Math.min(1, targetMaxFloat) : 1.0;

  let sumNormalized = 0;
  let validCount = 0;

  for (const item of inputs) {
    if (typeof item.float !== 'number' || Number.isNaN(item.float)) continue;
    const itemMin = typeof item.minFloat === 'number' ? Math.max(0, item.minFloat) : 0.0;
    const itemMax = typeof item.maxFloat === 'number' ? Math.min(1, item.maxFloat) : 1.0;
    const range = itemMax - itemMin;
    const normalized = range > 0 ? (item.float - itemMin) / range : 0.5;
    sumNormalized += Math.max(0, Math.min(1, normalized));
    validCount++;
  }

  if (validCount === 0) return null;
  const avgNormalized = sumNormalized / validCount;
  const outFloat = targetMin + avgNormalized * (targetMax - targetMin);
  return Math.max(targetMin, Math.min(targetMax, Math.round(outFloat * 1000000) / 1000000));
}
