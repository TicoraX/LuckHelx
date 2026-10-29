import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { rarityCategory } from './rarity.js';

// El color del grado es la verdad de CS2: si el tier no coincide con el color, la caja sortea
// con la probabilidad equivocada.
const TIER_BY_COLOR: Record<string, string> = {
  '#b0c3d9': 'common',
  '#5e98d9': 'common',
  '#4b69ff': 'common',
  '#8847ff': 'rare',
  '#d32ce6': 'epic',
  '#eb4b4b': 'epic',
};

describe('rarityCategory', () => {
  it('asigna cada objeto del preset al tier de su color', () => {
    const preset = JSON.parse(
      readFileSync(path.join(__dirname, 'cs2-cases-preset.json'), 'utf8')
    ) as { items: { rarity: string; rarityColor: string; isRare: boolean }[] }[];
    let checked = 0;
    for (const chest of preset) {
      for (const item of chest.items) {
        const expected = item.isRare ? 'legendary' : TIER_BY_COLOR[item.rarityColor.toLowerCase()];
        expect(rarityCategory(item.rarity, item.isRare), `${item.rarity} ${item.rarityColor}`).toBe(
          expected
        );
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10000);
  });

  it('falla con un grado que no conoce en vez de tratarlo como comun', () => {
    expect(() => rarityCategory('Contraband', false)).toThrow(/desconocido/);
  });
});
