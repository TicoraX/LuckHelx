import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { insertTask } from './tasks-store';
import { insertReward, listRewards } from './rewards-store';
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

    expect(backup.version).toBe(1);
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
    expect(isValidBackup({ ...backup, version: 2 })).toBe(false);
    expect(isValidBackup({ ...backup, tasks: 'not-an-array' })).toBe(false);
  });
});
