import { type ChestItem, pickChestItem } from './rewards';

export interface ReelChestItem extends ChestItem {
  image?: string | null;
  rarityColor?: string | null;
}

export interface ReelResult {
  items: ReelChestItem[];
  targetOffset: number;
}

const REEL_LENGTH = 40;

/** Índice fijo donde aterriza el premio dentro de la tira. */
export const WINNER_INDEX = 34;

// Medidas de la celda, exportadas para que el componente y el CSS no las declaren cada
// uno por su lado. El CSS las lee desde una custom property que setea el componente.
export const CELL_WIDTH = 190;
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
 * Instantes, en ms desde que arranca el giro, en que el carrete avanza cada una de las
 * `cells` celdas que recorre hasta el premio. Se calculan de antemano resolviendo la curva
 * y no leyendo el `transform` en cada frame: leer por frame tiene un jitter de hasta
 * 16,7 ms, más de la mitad del intervalo al arrancar (~29 ms), y en un celular que pierde
 * frames se salteaba ticks.
 *
 * Toma el recorrido como `cells` tramos iguales, no la geometría exacta de la tira, que
 * depende del ancho del contenedor: así el último tick cae justo cuando frena.
 */
export function reelTickTimes(durationMs: number, cells: number = WINNER_INDEX): number[] {
  const [x1, y1, x2, y2] = SPIN_BEZIER;
  const bezier = (s: number, p1: number, p2: number) =>
    3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s;

  const times: number[] = [];
  for (let k = 1; k <= cells; k++) {
    // El avance y(s) es monótono (y1 e y2 entre 0 y 1), así que la bisección converge.
    // 40 pasadas dejan el error muy por debajo de un microsegundo.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (bezier(mid, y1, y2) < k / cells) lo = mid;
      else hi = mid;
    }
    const t = bezier(hi, x1, x2) * durationMs;
    const last = times[times.length - 1];
    if (last === undefined || t - last >= MIN_TICK_GAP_MS) times.push(t);
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

  return { items, targetOffset };
}
