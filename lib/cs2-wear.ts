/**
 * lib/cs2-wear.ts - Tiers y rangos oficiales de desgaste CS2 (Valve Canonical).
 * Módulo puramente funcional y liviano (sin tablas JSON) para componentes de UI y cliente.
 */

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
export function formatFloat(float: number | null | undefined, digits = 4): string {
  if (typeof float !== 'number' || Number.isNaN(float)) return '';
  return float.toFixed(digits);
}
