import { describe, it, expect } from 'vitest';
import { filterAndSortInventory, type InventoryFilterItem } from './inventory-filter';

describe('Inventory Filter & Sort Engine', () => {
  const mockItems: InventoryFilterItem[] = [
    {
      id: '1',
      name: 'AK-47 | Redline',
      rarity: 'epic',
      image: null,
      count: 1,
      priceUsd: 15.5,
      priceWear: 'Field-Tested',
      priceStale: false,
      first_at: '2026-08-01T10:00:00Z',
      last_at: '2026-08-01T10:00:00Z',
    },
    {
      id: '2',
      name: 'AWP | Dragon Lore',
      rarity: 'legendary',
      image: null,
      count: 1,
      priceUsd: 2500.0,
      priceWear: 'Factory New',
      priceStale: false,
      first_at: '2026-08-10T12:00:00Z',
      last_at: '2026-08-10T12:00:00Z',
    },
    {
      id: '3',
      name: 'P250 | Sand Dune',
      rarity: 'common',
      image: null,
      count: 5,
      priceUsd: 0.1,
      priceWear: 'Well-Worn',
      priceStale: false,
      first_at: '2026-07-20T08:00:00Z',
      last_at: '2026-08-15T09:00:00Z',
    },
    {
      id: '4',
      name: 'M4A4 | Buzz Kill',
      rarity: 'rare',
      image: null,
      count: 2,
      priceUsd: null, // Unpriced item
      priceWear: 'Minimal Wear',
      priceStale: true,
      first_at: '2026-08-05T14:00:00Z',
      last_at: '2026-08-05T14:00:00Z',
    },
  ];

  it('filters by rarity and search text simultaneously without mutating original array', () => {
    const original = [...mockItems];
    const filtered = filterAndSortInventory(mockItems, { rarity: 'epic', search: 'Redline' });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
    expect(mockItems).toEqual(original); // Pure function check
  });

  it('sorts by price descending with unpriced items placed at the end', () => {
    const sorted = filterAndSortInventory(mockItems, { sortBy: 'price-desc' });
    expect(sorted.map((s) => s.id)).toEqual(['2', '1', '3', '4']);
  });

  it('sorts by price ascending with unpriced items placed at the end', () => {
    const sorted = filterAndSortInventory(mockItems, { sortBy: 'price-asc' });
    expect(sorted.map((s) => s.id)).toEqual(['3', '1', '2', '4']);
  });

  it('sorts by most recent acquisition date', () => {
    const sorted = filterAndSortInventory(mockItems, { sortBy: 'recent' });
    expect(sorted.map((s) => s.id)).toEqual(['3', '2', '4', '1']);
  });

  it('sorts alphabetically A-Z', () => {
    const sorted = filterAndSortInventory(mockItems, { sortBy: 'name-asc' });
    expect(sorted.map((s) => s.id)).toEqual(['1', '2', '4', '3']);
  });
});
