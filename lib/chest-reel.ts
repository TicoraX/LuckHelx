export interface ReelChestItem {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic';
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

  const items: ReelChestItem[] = [];
  for (let i = 0; i < REEL_LENGTH; i++) {
    items.push(i === WINNER_INDEX ? winner : pool[Math.floor(rand() * pool.length)]);
  }

  const winnerCenter = WINNER_INDEX * cellWidth + cellWidth / 2;
  const targetOffset = winnerCenter - containerWidth / 2;

  return { items, targetOffset };
}
