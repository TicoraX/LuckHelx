export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

// Debe seguir coincidiendo con el CHECK de rewards.rarity en lib/db.ts.
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface ChestItem {
  id: string;
  name: string;
  rarity: Rarity;
}

// Probabilidad por tier, no por objeto. Ponderar objeto por objeto hacía que la rareza
// dependiera de cuántas variantes trajera cada tier: una caja con 65 cuchillos y 3 skins
// comunes entregaba el tier más raro más de la mitad de las veces.
//
// CS2 real usa 79,92 / 15,98 / 3,84 / 0,26. El 0,26% está calibrado para un juego con
// millones de aperturas pagas; acá el usuario es uno solo, y a una caja por día ese
// número pone el primer cuchillo a 15 meses de distancia. 1,5% lo deja raro (uno cada
// ~65 aperturas) sin volverlo un evento que nunca llega.
const TIER_ODDS: Record<Rarity, number> = {
  common: 79.92,
  rare: 15.98,
  epic: 3.84,
  legendary: 1.5,
};

export function pickChestItem<T extends ChestItem>(items: T[], rand: () => number = Math.random): T {
  if (items.length === 0) throw new Error('cannot pick from an empty chest');

  const byTier = new Map<Rarity, T[]>();
  for (const item of items) {
    const tier = byTier.get(item.rarity);
    if (tier) tier.push(item);
    else byTier.set(item.rarity, [item]);
  }

  // Renormalizado sobre los tiers que la caja realmente tiene: sin esto, una caja sin
  // legendary dejaría un 1,5% del rango donde la tirada no cae en ningún tier.
  const total = [...byTier.keys()].reduce((sum, rarity) => sum + TIER_ODDS[rarity], 0);
  let roll = rand() * total;

  for (const [rarity, tierItems] of byTier) {
    roll -= TIER_ODDS[rarity];
    if (roll < 0) return tierItems[Math.floor(rand() * tierItems.length)];
  }

  const lastTier = [...byTier.values()][byTier.size - 1];
  return lastTier[Math.floor(rand() * lastTier.length)];
}
