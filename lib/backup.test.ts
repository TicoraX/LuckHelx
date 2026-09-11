import { describe, it, expect } from 'vitest';
import { createTestDb, initSchema } from './db';
import { insertTask } from './tasks-store';
import { insertReward, listRewards, addChestContents, listChestContents, redeemIfSufficient, listInventory } from './rewards-store';
import { setSkinPrice } from './skin-prices';
import { incrementXpBalance, getXpBalance, setDeepseekKey, getDeepseekKey } from './settings-store';
import { exportBackup, isValidBackup, restoreBackup, previewBackup } from './backup';

describe('backup', () => {
  it('exports every table', () => {
    const db = createTestDb();
    incrementXpBalance(db, 42);
    setDeepseekKey(db, 'sk-test');
    insertTask(db, { title: 'a', description: '', descriptionNormalized: 'a', xpValue: 10, xpReasoning: 'r' });
    insertReward(db, { type: 'shop', name: 'coffee', xpCost: 10, rarity: null });

    const backup = exportBackup(db);

    expect(backup.version).toBe(3);
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
    expect(isValidBackup({ ...backup, version: 2 })).toBe(true);
    expect(isValidBackup({ ...backup, version: 4 })).toBe(false);
    expect(isValidBackup({ ...backup, tasks: 'not-an-array' })).toBe(false);
  });

  it('generates a safe entity preview of valid and invalid backup objects', () => {
    const db = createTestDb();
    insertTask(db, { title: 'T1', description: '', descriptionNormalized: 't1', xpValue: 10, xpReasoning: 'r' });
    insertReward(db, { type: 'shop', name: 'R1', xpCost: 5, rarity: null });
    incrementXpBalance(db, 5000); // 50 XP natural

    const backup = exportBackup(db);
    const preview = previewBackup(backup);
    expect(preview.valid).toBe(true);
    expect(preview.tasksCount).toBe(1);
    expect(preview.rewardsCount).toBe(1);
    expect(preview.xpBalanceNatural).toBe(50);

    const badPreview = previewBackup({ corrupted: 'file' });
    expect(badPreview.valid).toBe(false);
    expect(badPreview.error).toBeDefined();
  });

  // Un respaldo de antes de la escala trae los montos en XP entero. Restaurarlo tal cual
  // dejaba el saldo cien veces chico; escalarlo y NO marcar la escala hacía que el próximo
  // arranque lo multiplicara otra vez. Las dos mitades tienen que pasar juntas.
  describe('un respaldo en la escala vieja', () => {
    const oldBackup = {
      version: 2 as const,
      exportedAt: '2026-08-01T00:00:00.000Z',
      meta: [
        { key: 'xp_balance', value: '250' },
        { key: 'key_cost_xp', value: '8' },
        { key: 'deepseek_api_key', value: 'sk-x' },
      ],
      tasks: [{ id: 't1', title: 'lavar', description: '', description_normalized: 'lavar', xp_value: 40, xp_reasoning: 'r', status: 'credited', created_at: '2026-08-01 00:00:00', completed_at: '2026-08-01 00:00:00' }],
      rewards: [{ id: 'c1', type: 'chest', name: 'Caja: A', xp_cost: 169, rarity: null, image: null, rarity_color: null, created_at: '2026-08-01 00:00:00' }],
      chestContents: [],
      redemptions: [{ id: 'd1', reward_id: 'c1', xp_spent: 169, redeemed_at: '2026-08-01 00:00:00' }],
    };

    it('scales every amount exactly once and marks the new scale', () => {
      const db = createTestDb();
      expect(isValidBackup(oldBackup)).toBe(true);
      restoreBackup(db, oldBackup);

      expect(getXpBalance(db)).toBe(25000);
      expect((db.prepare('SELECT xp_value v FROM tasks').get() as { v: number }).v).toBe(4000);
      expect((db.prepare('SELECT xp_cost c FROM rewards').get() as { c: number }).c).toBe(16900);
      expect((db.prepare('SELECT xp_spent s FROM redemptions').get() as { s: number }).s).toBe(16900);
      expect((db.prepare("SELECT value FROM meta WHERE key = 'key_cost_xp'").get() as { value: string }).value).toBe('800');

      // Sin esta marca, el siguiente initSchema vuelve a multiplicar por cien.
      expect((db.prepare("SELECT value FROM meta WHERE key = 'xp_scale'").get() as { value: string }).value).toBe('100');
      initSchema(db);
      expect(getXpBalance(db)).toBe(25000);
    });

    it('leaves a non-XP setting untouched', () => {
      const db = createTestDb();
      restoreBackup(db, oldBackup);
      expect(getDeepseekKey(db)).toBe('sk-x');
    });
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

  it('preserves quest_claims and daily_spins across export and restore', () => {
    const source = createTestDb();
    source.prepare(
      `INSERT INTO quest_claims (id, quest_id, claimed_date, xp_awarded, claimed_at)
       VALUES ('qc-1', 'daily_tasks_2026-08-28', '2026-08-28', 2500, '2026-08-28 10:00:00')`
    ).run();

    source.prepare(
      `INSERT INTO daily_spins (id, spin_date, reward_type, xp_awarded, spun_at)
       VALUES ('spin-1', '2026-08-28', 'jackpot', 15000, '2026-08-28 09:00:00')`
    ).run();

    const backup = exportBackup(source);
    expect(backup.questClaims).toHaveLength(1);
    expect(backup.dailySpins).toHaveLength(1);

    const target = createTestDb();
    restoreBackup(target, backup);

    const restoredQuests = target.prepare('SELECT * FROM quest_claims').all() as any[];
    const restoredSpins = target.prepare('SELECT * FROM daily_spins').all() as any[];

    expect(restoredQuests).toHaveLength(1);
    expect(restoredQuests[0].quest_id).toBe('daily_tasks_2026-08-28');
    expect(restoredSpins).toHaveLength(1);
    expect(restoredSpins[0].reward_type).toBe('jackpot');
  });
});
