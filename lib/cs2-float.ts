/**
 * lib/cs2-float.ts - Lógica matemática canónica de desgaste (Float) de Counter-Strike 2.
 * Define los 5 rangos oficiales de Valve, cálculo determinista de float y fórmula de Trade-Up.
 */

import floatRangesRaw from './cs2-float-ranges.json';

export * from './cs2-wear';

const FLOAT_RANGES: Record<string, [number, number]> = floatRangesRaw as unknown as Record<
  string,
  [number, number]
>;

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
