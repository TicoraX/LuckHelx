import { ChestItem, pickChestItem } from './rewards';

export interface ReelChestItem extends ChestItem {
  image?: string | null;
  rarityColor?: string | null;
}

export interface ReelResult {
  items: ReelChestItem[];
  targetOffset: number;
}

const REEL_LENGTH = 40;
const WINNER_INDEX = 34;
const ITEM_GAP = 10;

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
