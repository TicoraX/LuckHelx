export interface InventoryFilterItem {
  id: string;
  name: string;
  rarity: string | null;
  image: string | null;
  count: number;
  priceUsd: number | null;
  priceWear: string | null;
  priceStale: boolean;
  first_at: string;
  last_at: string;
}

export type InventorySortOption = 'price-desc' | 'price-asc' | 'recent' | 'oldest' | 'name-asc' | 'name-desc';

export interface InventoryFilterCriteria {
  search?: string;
  rarity?: string;
  sortBy?: InventorySortOption;
}

export function filterAndSortInventory<T extends InventoryFilterItem>(
  items: T[],
  criteria: InventoryFilterCriteria = {}
): T[] {
  const { search = '', rarity = 'all', sortBy = 'recent' } = criteria;
  const searchLower = search.trim().toLowerCase();

  const filtered = items.filter((item) => {
    const matchesRarity = rarity === 'all' || (item.rarity ?? 'common').toLowerCase() === rarity.toLowerCase();
    const matchesSearch =
      !searchLower ||
      item.name.toLowerCase().includes(searchLower) ||
      (item.priceWear && item.priceWear.toLowerCase().includes(searchLower));

    return matchesRarity && matchesSearch;
  });

  return filtered.sort((a, b) => {
    switch (sortBy) {
      case 'price-desc': {
        // Items with price come first, sorted highest to lowest
        if (a.priceUsd !== null && b.priceUsd !== null) return b.priceUsd - a.priceUsd;
        if (a.priceUsd !== null) return -1;
        if (b.priceUsd !== null) return 1;
        return a.name.localeCompare(b.name);
      }
      case 'price-asc': {
        // Items with price come first, sorted lowest to highest
        if (a.priceUsd !== null && b.priceUsd !== null) return a.priceUsd - b.priceUsd;
        if (a.priceUsd !== null) return -1;
        if (b.priceUsd !== null) return 1;
        return a.name.localeCompare(b.name);
      }
      case 'recent': {
        const timeA = new Date(a.last_at || a.first_at).getTime();
        const timeB = new Date(b.last_at || b.first_at).getTime();
        return timeB - timeA;
      }
      case 'oldest': {
        const timeA = new Date(a.first_at || a.last_at).getTime();
        const timeB = new Date(b.first_at || b.last_at).getTime();
        return timeA - timeB;
      }
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      default:
        return 0;
    }
  });
}
