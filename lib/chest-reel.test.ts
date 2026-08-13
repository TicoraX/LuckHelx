import { describe, it, expect } from 'vitest';
import { buildReel, ReelChestItem } from './chest-reel';

const pool: ReelChestItem[] = [
  { id: '1', name: 'common item', rarity: 'common' },
  { id: '2', name: 'rare item', rarity: 'rare' },
  { id: '3', name: 'epic item', rarity: 'epic' },
];

describe('buildReel', () => {
  it('places the winner at the fixed landing index in the strip', () => {
    const { items } = buildReel(pool, '2', 120, 600, () => 0);
    expect(items[34].id).toBe('2');
  });

  it('computes a targetOffset that centers the winner under the viewport middle', () => {
    const { targetOffset } = buildReel(pool, '2', 120, 600, () => 0);
    const cellWidth = 130; // itemWidth (120) + fixed 10px gap
    const winnerCenter = 34 * cellWidth + cellWidth / 2;
    expect(targetOffset).toBe(winnerCenter - 300);
  });

  it('throws on an empty pool', () => {
    expect(() => buildReel([], '1', 120, 600)).toThrow();
  });

  it('throws when winnerId is not in the pool', () => {
    expect(() => buildReel(pool, 'missing', 120, 600)).toThrow();
  });

  it('fills non-winner slots using the provided rand function', () => {
    const { items } = buildReel(pool, '2', 120, 600, () => 0.999999);
    expect(items[0].id).toBe('3');
  });

  // El componente dibuja toda celda legendary como la misma estrella dorada anónima. Si
  // los señuelos salieran uniformes del pool, una caja real (65 cuchillos sobre 74) haría
  // que casi toda la tira fuera esa estrella y el carrete dejaría de leerse como carrete.
  it('keeps legendary decoys rare even when the pool is mostly legendary', () => {
    const realShapedPool: ReelChestItem[] = [
      ...Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, name: `common ${i}`, rarity: 'common' as const })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `r${i}`, name: `rare ${i}`, rarity: 'rare' as const })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `e${i}`, name: `epic ${i}`, rarity: 'epic' as const })),
      ...Array.from({ length: 65 }, (_, i) => ({ id: `l${i}`, name: `knife ${i}`, rarity: 'legendary' as const })),
    ];

    let seed = 11;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    // 200 tiras seguidas: una sola podría salir limpia por azar.
    let legendaryCells = 0;
    let totalDecoys = 0;
    for (let strip = 0; strip < 200; strip++) {
      const { items } = buildReel(realShapedPool, 'c0', 120, 600, rand);
      items.forEach((item, i) => {
        if (i === 34) return; // el ganador lo fija el servidor, no el muestreo
        totalDecoys++;
        if (item.rarity === 'legendary') legendaryCells++;
      });
    }

    expect(legendaryCells / totalDecoys).toBeLessThan(0.05);
  });
});
