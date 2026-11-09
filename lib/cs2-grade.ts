/**
 * Modelo puro de Grados Oficiales de CS2.
 *
 * Mapea los 6 grados oficiales de armas más la distinción extraordinaria
 * (cuchillos y guantes dorados) a partir del color hex del preset y la condición
 * de rareza de la app, sin requerir migraciones de base de datos.
 */

export type Cs2GradeId =
  | 'consumer'
  | 'industrial'
  | 'milspec'
  | 'restricted'
  | 'classified'
  | 'covert'
  | 'extraordinary';

export type Cs2GradeName =
  | 'Consumer Grade'
  | 'Industrial Grade'
  | 'Mil-Spec Grade'
  | 'Restricted'
  | 'Classified'
  | 'Covert'
  | 'Extraordinary';

export interface Cs2GradeInfo {
  id: Cs2GradeId;
  name: Cs2GradeName;
  nameEs: string;
  hex: string;
  cssVar: string;
  rank: number;
  canTradeUp: boolean;
  nextGradeId: Cs2GradeId | null;
}

export const CS2_GRADES: Record<Cs2GradeId, Cs2GradeInfo> = {
  consumer: {
    id: 'consumer',
    name: 'Consumer Grade',
    nameEs: 'Grado Consumidor',
    hex: '#b0c3d9',
    cssVar: '--grade-consumer',
    rank: 0,
    canTradeUp: true,
    nextGradeId: 'industrial',
  },
  industrial: {
    id: 'industrial',
    name: 'Industrial Grade',
    nameEs: 'Grado Industrial',
    hex: '#5e98d9',
    cssVar: '--grade-industrial',
    rank: 1,
    canTradeUp: true,
    nextGradeId: 'milspec',
  },
  milspec: {
    id: 'milspec',
    name: 'Mil-Spec Grade',
    nameEs: 'Grado Militar',
    hex: '#4b69ff',
    cssVar: '--grade-milspec',
    rank: 2,
    canTradeUp: true,
    nextGradeId: 'restricted',
  },
  restricted: {
    id: 'restricted',
    name: 'Restricted',
    nameEs: 'Restringido',
    hex: '#8847ff',
    cssVar: '--grade-restricted',
    rank: 3,
    canTradeUp: true,
    nextGradeId: 'classified',
  },
  classified: {
    id: 'classified',
    name: 'Classified',
    nameEs: 'Clasificado',
    hex: '#d32ce6',
    cssVar: '--grade-classified',
    rank: 4,
    canTradeUp: true,
    nextGradeId: 'covert',
  },
  covert: {
    id: 'covert',
    name: 'Covert',
    nameEs: 'Secreto',
    hex: '#eb4b4b',
    cssVar: '--grade-covert',
    rank: 5,
    canTradeUp: false,
    nextGradeId: null,
  },
  extraordinary: {
    id: 'extraordinary',
    name: 'Extraordinary',
    nameEs: 'Extraordinario (Cuchillo / Guante)',
    hex: '#ffd700',
    cssVar: '--grade-special',
    rank: 6,
    canTradeUp: false,
    nextGradeId: null,
  },
};

/**
 * Grados elegibles como entrada para el contrato estándar de 10 skins de CS2
 * (Consumer hasta Classified).
 */
export const TRADE_UP_INPUT_GRADES: Cs2GradeId[] = [
  'consumer',
  'industrial',
  'milspec',
  'restricted',
  'classified',
];

/**
 * Deduce el grado oficial de CS2 a partir del color hex del preset y la condición
 * de cuchillo/guante (legendary).
 */
export function getCs2Grade(
  rarityColorOrItem?:
    | string
    | null
    | { rarityColor?: string | null; rarity_color?: string | null; rarity?: string | null; isRare?: boolean },
  isLegendaryInput?: boolean
): Cs2GradeInfo {
  let hex = '';
  let isLegendary = false;

  if (typeof rarityColorOrItem === 'object' && rarityColorOrItem !== null) {
    hex = rarityColorOrItem.rarity_color || rarityColorOrItem.rarityColor || '';
    isLegendary =
      Boolean(rarityColorOrItem.isRare) ||
      rarityColorOrItem.rarity === 'legendary' ||
      Boolean(isLegendaryInput);
  } else {
    hex = rarityColorOrItem || '';
    isLegendary = Boolean(isLegendaryInput);
  }

  const cleanHex = hex.trim().toLowerCase();

  if (isLegendary || cleanHex === '#ffd700' || cleanHex === '#e4ae39') {
    return CS2_GRADES.extraordinary;
  }

  switch (cleanHex) {
    case '#b0c3d9':
      return CS2_GRADES.consumer;
    case '#5e98d9':
      return CS2_GRADES.industrial;
    case '#4b69ff':
      return CS2_GRADES.milspec;
    case '#8847ff':
      return CS2_GRADES.restricted;
    case '#d32ce6':
      return CS2_GRADES.classified;
    case '#eb4b4b':
      return CS2_GRADES.covert;
    default:
      // Si el color no coincide exactamente con ningún grado oficial,
      // cae al grado Mil-Spec (el más poblado con 3.410 skins) o Extraordinary si era legendary.
      return isLegendary ? CS2_GRADES.extraordinary : CS2_GRADES.milspec;
  }
}

/**
 * Retorna la información de un grado por su id.
 */
export function getGradeById(id: Cs2GradeId): Cs2GradeInfo {
  const grade = CS2_GRADES[id];
  if (!grade) {
    throw new Error(`Grado de CS2 desconocido: ${id}`);
  }
  return grade;
}

/**
 * Retorna el grado inmediatamente superior para el contrato de intercambio de CS2.
 * Devuelve null si el grado no tiene grado superior en el contrato de 10.
 */
export function getNextGrade(gradeId: Cs2GradeId): Cs2GradeInfo | null {
  const current = getGradeById(gradeId);
  return current.nextGradeId ? CS2_GRADES[current.nextGradeId] : null;
}

/**
 * Determina si un grado es elegible como entrada para el contrato Trade-Up de 10 skins.
 */
export function isTradeUpEligible(gradeId: Cs2GradeId): boolean {
  return CS2_GRADES[gradeId]?.canTradeUp ?? false;
}
