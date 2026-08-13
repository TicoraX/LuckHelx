import { describe, it, expect } from 'vitest';
import { pickChestItem, ChestItem } from './rewards';

const items: ChestItem[] = [
  { id: '1', name: 'common item', rarity: 'common' },
  { id: '2', name: 'rare item', rarity: 'rare' },
  { id: '3', name: 'epic item', rarity: 'epic' },
];

describe('pickChestItem', () => {
  it('picks the common item when rand returns 0', () => {
    expect(pickChestItem(items, () => 0).id).toBe('1');
  });

  it('picks the epic item when rand returns just under 1', () => {
    expect(pickChestItem(items, () => 0.999999).id).toBe('3');
  });

  it('throws on an empty item list', () => {
    expect(() => pickChestItem([], () => 0.5)).toThrow();
  });
});

describe('pickChestItem with a legendary item in the pool', () => {
  const itemsWithLegendary: ChestItem[] = [
    { id: '1', name: 'common item', rarity: 'common' },
    { id: '2', name: 'rare item', rarity: 'rare' },
    { id: '3', name: 'epic item', rarity: 'epic' },
    { id: '4', name: 'knife', rarity: 'legendary' },
  ];

  it('picks the legendary item only on the narrow top slice of the roll', () => {
    // tiers = 79.92 + 15.98 + 3.84 + 1.5 = 101.24; legendary occupies the last 1.5
    expect(pickChestItem(itemsWithLegendary, () => 0.999999).id).toBe('4');
  });

  it('still picks common/rare/epic correctly with a legendary item present', () => {
    expect(pickChestItem(itemsWithLegendary, () => 0).id).toBe('1');
  });
});

describe('pickChestItem odds do not depend on how many items a tier holds', () => {
  // Forma de una caja real de CS2: 3 comunes, 3 restricted, 3 covert y 65 variantes de
  // cuchillo. Ponderando por objeto, ese tier de 65 se llevaba más de la mitad de las
  // aperturas justamente por ser el más numeroso.
  const realShapedCase: ChestItem[] = [
    ...Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, name: `common ${i}`, rarity: 'common' as const })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `r${i}`, name: `rare ${i}`, rarity: 'rare' as const })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `e${i}`, name: `epic ${i}`, rarity: 'epic' as const })),
    ...Array.from({ length: 65 }, (_, i) => ({ id: `l${i}`, name: `knife ${i}`, rarity: 'legendary' as const })),
  ];

  function rollMany(items: ChestItem[], rolls: number) {
    // LCG sembrado: la distribución tiene que ser reproducible entre corridas, si no el
    // test falla una vez cada tantas por azar y se termina borrando.
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const counts: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < rolls; i++) counts[pickChestItem(items, rand).rarity]++;
    return counts;
  }

  it('lands legendary near 1.5% on a case where 65 of 74 items are legendary', () => {
    const counts = rollMany(realShapedCase, 100_000);
    const legendaryPct = (counts.legendary / 100_000) * 100;

    expect(legendaryPct).toBeGreaterThan(1.2);
    expect(legendaryPct).toBeLessThan(1.8);
  });

  it('lands common near 79% on that same case', () => {
    const counts = rollMany(realShapedCase, 100_000);
    const commonPct = (counts.common / 100_000) * 100;

    expect(commonPct).toBeGreaterThan(77);
    expect(commonPct).toBeLessThan(82);
  });

  it('spreads the roll across every item inside the winning tier', () => {
    const counts: Record<string, number> = {};
    let seed = 7;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < 20_000; i++) {
      const picked = pickChestItem(realShapedCase, rand);
      counts[picked.id] = (counts[picked.id] ?? 0) + 1;
    }

    // Los 65 cuchillos comparten el 1,5%: ninguno puede acaparar el tier.
    const knivesSeen = Object.keys(counts).filter((id) => id.startsWith('l')).length;
    expect(knivesSeen).toBeGreaterThan(40);
  });

  it('renormalizes when a tier is missing so the roll never falls through', () => {
    const noLegendary: ChestItem[] = [
      { id: '1', name: 'common', rarity: 'common' },
      { id: '2', name: 'rare', rarity: 'rare' },
    ];

    // Con la tirada al tope, el resultado tiene que ser el último tier presente y no
    // caerse por el hueco que dejarían epic y legendary.
    expect(pickChestItem(noLegendary, () => 0.999999).id).toBe('2');
  });
});
