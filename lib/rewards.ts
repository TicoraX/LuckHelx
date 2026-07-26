export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ChestItem {
  id: string;
  name: string;
  rarity: Rarity;
}

const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 70,
  rare: 25,
  epic: 5,
  legendary: 0.3,
};

export function pickChestItem(items: ChestItem[], rand: () => number = Math.random): ChestItem {
  if (items.length === 0) throw new Error('cannot pick from an empty chest');

  const totalWeight = items.reduce((sum, item) => sum + RARITY_WEIGHT[item.rarity], 0);
  let roll = rand() * totalWeight;

  for (const item of items) {
    roll -= RARITY_WEIGHT[item.rarity];
    if (roll < 0) return item;
  }

  return items[items.length - 1];
}
