import { describe, expect, it } from 'vitest';
import { buildReel, highestRarity, type ReelChestItem, reelTickTimes } from './chest-reel';

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
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `c${i}`,
        name: `common ${i}`,
        rarity: 'common' as const,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `r${i}`,
        name: `rare ${i}`,
        rarity: 'rare' as const,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `e${i}`,
        name: `epic ${i}`,
        rarity: 'epic' as const,
      })),
      ...Array.from({ length: 65 }, (_, i) => ({
        id: `l${i}`,
        name: `knife ${i}`,
        rarity: 'legendary' as const,
      })),
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

describe('reelTickTimes', () => {
  // Escritorio: celda 220 + espacio 10, viewport de 1174 px.
  const reel = buildReel(pool, '2', 220, 1174, () => 0);

  it('ticks once per cell border that crosses the marker, at the border, before the stop', () => {
    const times = reelTickTimes(6500, reel);
    const { pitchPx, markerStartPx, targetOffset } = reel;
    const borders =
      Math.floor((markerStartPx + targetOffset) / pitchPx) - Math.floor(markerStartPx / pitchPx);
    expect(times).toHaveLength(borders);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    expect(gaps.every((gap) => gap > 0)).toBe(true);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(25);
    // El último borde es la entrada al ganador: suena antes de que frene, no al frenar.
    expect(times[times.length - 1]).toBeLessThan(6500);
  });

  it('places each tick where the strip has moved a border onto the marker', () => {
    const times = reelTickTimes(6500, reel);
    const [x1, y1, x2, y2] = [0.12, 0.8, 0.18, 1];
    const bez = (s: number, a: number, b: number) =>
      3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
    // Avance de la tira en el instante del primer tick, por bisección inversa en x.
    const t = times[0] / 6500;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (bez(mid, x1, x2) < t) lo = mid;
      else hi = mid;
    }
    const markerAt = reel.markerStartPx + bez(hi, y1, y2) * reel.targetOffset;
    expect(markerAt % reel.pitchPx).toBeCloseTo(0, 0);
  });

  // El giro se puede bajar a 500 ms en Ajustes: ahi los ticks no entran sin pisarse.
  it('drops ticks that would overlap on a very short spin', () => {
    const full = reelTickTimes(6500, reel);
    const times = reelTickTimes(500, reel);
    expect(times.length).toBeLessThan(full.length);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(25);
  });
});

describe('highestRarity', () => {
  it('picks the top tier in common < rare < epic < legendary order', () => {
    expect(highestRarity(['common', 'epic', 'rare'])).toBe('epic');
    expect(highestRarity(['rare', 'legendary', 'common'])).toBe('legendary');
    expect(highestRarity(['common', 'common'])).toBe('common');
  });

  it('falls back to common for an empty or unknown list', () => {
    expect(highestRarity([])).toBe('common');
    expect(highestRarity(['mythic'])).toBe('common');
  });
});
