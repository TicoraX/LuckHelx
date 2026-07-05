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
});
