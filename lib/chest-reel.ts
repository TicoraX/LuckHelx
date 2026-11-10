import { getCs2Color } from './cs2-grade';
import { type ChestItem, pickChestItem, type Rarity } from './rewards';

export interface ReelChestItem extends ChestItem {
  image?: string | null;
  rarityColor?: string | null;
}

/**
 * Retorna el color CSS para la celda del carrete.
 * Los legendarios comparten el dorado anónimo para no delatar cuál cuchillo es antes de frenar.
 */
export function reelCellColor(item: ReelChestItem): string {
  if (item.rarity === 'legendary') return 'var(--rarity-legendary)';
  return getCs2Color(item);
}

/** Calienta el caché del navegador para las imágenes de la tira. Seguro en entornos SSR/Node. */
export function preloadImages(urls: string[]): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.src = url;
        })
    )
  ).then(() => undefined);
}

export interface ReelResult {
  items: ReelChestItem[];
  targetOffset: number;
  /** Paso de la tira (celda + espacio) y posición del marcador en la tira al arrancar. */
  pitchPx: number;
  markerStartPx: number;
}

const REEL_LENGTH = 40;

/** Índice fijo donde aterriza el premio dentro de la tira. */
export const WINNER_INDEX = 34;

// Medidas de la celda, exportadas para que el componente y el CSS no las declaren cada
// uno por su lado. El CSS las lee desde una custom property que setea el componente.
export const CELL_WIDTH = 220;
// Celda del duelo 1v1 (components/CaseBattleModal.tsx): dos carretes apilados, más angostos.
// Bajo COMPACT_VIEWPORT_PX también usa COMPACT_CELL_WIDTH.
export const BATTLE_CELL_WIDTH = 150;
// Bajo COMPACT_VIEWPORT_PX la celda de 220 ocupa casi todo el carrete y se ve una sola skin
// cortada; con 96 entran unas tres, como en el escritorio se ven cinco.
export const COMPACT_CELL_WIDTH = 96;
export const COMPACT_VIEWPORT_PX = 480;
export const CELL_GAP = 10;

const ITEM_GAP = CELL_GAP;

// Curva del giro. Vive acá y no en el componente porque los ticks del carrete se calculan
// sobre ella: si el CSS y el cálculo usaran curvas distintas, el sonido se correría.
const SPIN_BEZIER = [0.12, 0.8, 0.18, 1] as const;
export const SPIN_EASING = `cubic-bezier(${SPIN_BEZIER.join(', ')})`;

// Un tick dura unos 25 ms. Más juntos se pisan, y eso pasa si alguien baja el giro en
// Ajustes al mínimo (500 ms): ahí se descartan los que caerían encima del anterior.
const MIN_TICK_GAP_MS = 25;

/**
 * Instantes, en ms desde que arranca el giro, en que un borde entre dos celdas cruza el
 * marcador: el tick de CS2 suena cuando entra una skin nueva, no en su centro. Se calculan
 * de antemano resolviendo la curva y no leyendo el `transform` en cada frame: leer por frame
 * tiene un jitter de hasta 16,7 ms, más de la mitad del intervalo al arrancar, y en un
 * celular que pierde frames se salteaba ticks.
 *
 * Usa la geometría real de la tira (`buildReel`): antes repartía el recorrido en 34 tramos
 * iguales, pero el recorrido no mide 34 celdas (arranca con el marcador a mitad del viewport
 * y termina en el centro del ganador), así que los ticks se corrían respecto de las skins.
 * La celda i ocupa [i*paso, (i+1)*paso] con su espacio partido a cada lado: el borde j está
 * en j*paso. El último cruce es la entrada al ganador, medio paso antes de frenar.
 */
export function reelTickTimes(
  durationMs: number,
  reel: Pick<ReelResult, 'targetOffset' | 'pitchPx' | 'markerStartPx'>
): number[] {
  const [x1, y1, x2, y2] = SPIN_BEZIER;
  const bezier = (s: number, p1: number, p2: number) =>
    3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s;
  const { targetOffset, pitchPx, markerStartPx } = reel;
  if (targetOffset <= 0 || pitchPx <= 0) return [];

  const times: number[] = [];
  const first = Math.floor(markerStartPx / pitchPx) + 1;
  const last = Math.floor((markerStartPx + targetOffset) / pitchPx);
  for (let j = first; j <= last; j++) {
    const progress = (j * pitchPx - markerStartPx) / targetOffset;
    // El avance y(s) es monótono (y1 e y2 entre 0 y 1), así que la bisección converge.
    // 40 pasadas dejan el error muy por debajo de un microsegundo.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (bezier(mid, y1, y2) < progress) lo = mid;
      else hi = mid;
    }
    const t = bezier(hi, x1, x2) * durationMs;
    const prev = times[times.length - 1];
    if (prev === undefined || t - prev >= MIN_TICK_GAP_MS) times.push(t);
  }
  return times;
}

export function buildReel(
  pool: ReelChestItem[],
  winnerId: string,
  itemWidth: number,
  containerWidth: number,
  rand: () => number = Math.random
): ReelResult {
  if (pool.length === 0) throw new Error('cannot build a reel from an empty pool');

  const winner = pool.find((item) => item.id === winnerId);
  if (!winner) throw new Error(`winnerId ${winnerId} not found in pool`);

  const cellWidth = itemWidth + ITEM_GAP;

  // Los señuelos se sortean con la misma distribución que el premio. Tomarlos uniformes
  // del pool hacía que el carrete reflejara la forma del catálogo y no la del juego: una
  // caja con 65 cuchillos sobre 74 objetos se veía como una pared de estrellas doradas
  // idénticas, y la estrella dejaba de significar "esto es raro".
  const items: ReelChestItem[] = [];
  for (let i = 0; i < REEL_LENGTH; i++) {
    items.push(i === WINNER_INDEX ? winner : pickChestItem(pool, rand));
  }

  const winnerCenter = WINNER_INDEX * cellWidth + cellWidth / 2;
  const targetOffset = winnerCenter - containerWidth / 2;

  return { items, targetOffset, pitchPx: cellWidth, markerStartPx: containerWidth / 2 };
}

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'] as const;

/** La rareza más alta de una tanda: el 5x toca un solo revelado, el del mejor premio. */
export function highestRarity(rarities: string[]): Rarity {
  let best = 0;
  for (const r of rarities) best = Math.max(best, RARITY_ORDER.indexOf(r as Rarity));
  return RARITY_ORDER[best];
}
