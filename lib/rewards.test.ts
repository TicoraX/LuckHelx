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
