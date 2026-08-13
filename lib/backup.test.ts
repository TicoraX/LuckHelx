import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { insertTask } from './tasks-store';
import { insertReward, listRewards, addChestContents, listChestContents, redeemIfSufficient, listInventory } from './rewards-store';
import { setSkinPrice } from './skin-prices';
import { incrementXpBalance, getXpBalance, setDeepseekKey, getDeepseekKey } from './settings-store';
import { exportBackup, isValidBackup, restoreBackup } from './backup';

describe('backup', () => {
  it('exports every table', () => {
    const db = createTestDb();
    incrementXpBalance(db, 42);
    setDeepseekKey(db, 'sk-test');
    insertTask(db, { title: 'a', description: '', descriptionNormalized: 'a', xpValue: 10, xpReasoning: 'r' });
    insertReward(db, { type: 'shop', name: 'coffee', xpCost: 10, rarity: null });

    const backup = exportBackup(db);

    expect(backup.version).toBe(2);
    expect(backup.tasks).toHaveLength(1);
    expect(backup.rewards).toHaveLength(1);
    expect(backup.meta.find((m) => m.key === 'xp_balance')?.value).toBe('42');
    expect(backup.meta.find((m) => m.key === 'deepseek_api_key')?.value).toBe('sk-test');
  });

  it('round-trips through export -> restore into a fresh db', () => {
    const source = createTestDb();
    incrementXpBalance(source, 75);
    setDeepseekKey(source, 'sk-round-trip');
    insertTask(source, { title: 'lavar platos', description: '', descriptionNormalized: 'lavar platos', xpValue: 15, xpReasoning: 'r' });
    insertReward(source, { type: 'shop', name: 'coffee', xpCost: 10, rarity: null });

    const backup = exportBackup(source);

    const target = createTestDb();
    restoreBackup(target, backup);

    expect(getXpBalance(target)).toBe(75);
    expect(getDeepseekKey(target)).toBe('sk-round-trip');
    expect(listRewards(target).map((r) => r.name)).toEqual(['coffee']);
  });

  it('round-trips a chest and its chest_contents links', () => {
    const source = createTestDb();
    const chest = insertReward(source, { type: 'chest', name: 'caja', xpCost: 20, rarity: null });
    const item = insertReward(source, {
      type: 'chest_item',
      name: 'cuchillo',
      xpCost: 5,
      rarity: 'legendary',
      image: 'https://example.test/knife.png',
      rarityColor: '#ffd700',
    });
    addChestContents(source, chest.id, item.id);

    const backup = exportBackup(source);

    const target = createTestDb();
    restoreBackup(target, backup);

    expect(listChestContents(target)).toEqual([{ chestId: chest.id, chestItemId: item.id }]);
    const restoredItem = listRewards(target).find((r) => r.id === item.id);
    expect(restoredItem?.image).toBe('https://example.test/knife.png');
    expect(restoredItem?.rarity_color).toBe('#ffd700');
  });

  it('restore replaces existing data rather than appending to it', () => {
    const db = createTestDb();
    insertReward(db, { type: 'shop', name: 'old-reward', xpCost: 5, rarity: null });
    const backup = exportBackup(createTestDb()); // an empty db's backup

    restoreBackup(db, backup);

    expect(listRewards(db)).toHaveLength(0);
  });

  it('ignores unknown keys while restoring imported rows', () => {
    const source = createTestDb();
    insertReward(source, { type: 'shop', name: 'coffee', xpCost: 10, rarity: null });
    const backup = exportBackup(source);
    backup.rewards = [{ ...backup.rewards[0], unexpected: 'value' }];

    expect(() => restoreBackup(createTestDb(), backup)).not.toThrow();
  });

  it('validates a well-formed backup and rejects malformed ones', () => {
    const db = createTestDb();
    const backup = exportBackup(db);

    expect(isValidBackup(backup)).toBe(true);
    expect(isValidBackup(null)).toBe(false);
    expect(isValidBackup({})).toBe(false);
    // Los respaldos viejos se siguen aceptando: lo que no traen queda vacío.
    expect(isValidBackup({ ...backup, version: 1 })).toBe(true);
    expect(isValidBackup({ ...backup, version: 3 })).toBe(false);
    expect(isValidBackup({ ...backup, tasks: 'not-an-array' })).toBe(false);
  });

  // El respaldo se quedó atrás cuando entraron el inventario y la reventa: exportaba los
  // canjes sin el arma que salió, y ni item_sales ni skin_prices. Restaurar ese archivo
  // devolvía la base con el inventario vacío.
  it('carries the won item, the sales and the prices through a round-trip', () => {
    const db = createTestDb();
    const chest = insertReward(db, { type: 'chest', name: 'Caja: A', xpCost: 10, rarity: null });
    const skin = insertReward(db, { type: 'chest_item', name: 'AK-47 | Redline', xpCost: 1, rarity: 'epic' });
    incrementXpBalance(db, 100);
    redeemIfSufficient(db, chest.id, { id: skin.id, name: skin.name, rarity: 'epic', image: null });
    setSkinPrice(db, 'AK-47 | Redline', 16.07, 'Field-Tested');

    const backup = exportBackup(db);
    expect(backup.redemptions[0].won_item_name).toBe('AK-47 | Redline');
    expect(backup.skinPrices).toHaveLength(1);

    const fresh = createTestDb();
    restoreBackup(fresh, backup);

    expect(listInventory(fresh)).toHaveLength(1);
    const restored = fresh.prepare('SELECT * FROM skin_prices').all() as Record<string, unknown>[];
    expect(restored[0].usd).toBe(16.07);
  });
});
