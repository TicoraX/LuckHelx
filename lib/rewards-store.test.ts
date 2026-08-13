import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { getXpBalance, incrementXpBalance } from './settings-store';
import {
  listRewards, insertReward, getRewardById, countRedemptions, redeemIfSufficient,
  updateReward, deleteReward, listRedemptions, addChestContents, getChestPool, listChestContents,
  listInventory, sellOneItem, listSales,
} from './rewards-store';

describe('rewards-store', () => {
  it('inserts and lists rewards, oldest first', () => {
    const db = createTestDb();
    insertReward(db, { type: 'shop', name: 'a', xpCost: 10, rarity: null });
    insertReward(db, { type: 'shop', name: 'b', xpCost: 20, rarity: null });
    expect(listRewards(db).map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('breaks ties in oldest-first order with rowid ascending', () => {
    const db = createTestDb();
    db.prepare(
      `INSERT INTO rewards (id, type, name, xp_cost, rarity, created_at)
       VALUES ('r1', 'shop', 'a', 10, NULL, '2026-07-19T00:00:00.000Z')`
    ).run();
    db.prepare(
      `INSERT INTO rewards (id, type, name, xp_cost, rarity, created_at)
       VALUES ('r2', 'shop', 'b', 20, NULL, '2026-07-19T00:00:00.000Z')`
    ).run();

    expect(listRewards(db).map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('redeems successfully when balance is sufficient, deducting exactly the cost', () => {
    const db = createTestDb();
    incrementXpBalance(db, 50);
    const reward = insertReward(db, { type: 'shop', name: 'coffee', xpCost: 30, rarity: null });

    const redeemed = redeemIfSufficient(db, reward.id);

    expect(redeemed?.name).toBe('coffee');
    expect(getXpBalance(db)).toBe(20);
    expect(countRedemptions(db)).toBe(1);
  });

  it('rejects redeeming twice when the balance only covers it once', () => {
    const db = createTestDb();
    incrementXpBalance(db, 30);
    const reward = insertReward(db, { type: 'shop', name: 'coffee', xpCost: 30, rarity: null });

    expect(redeemIfSufficient(db, reward.id)).not.toBeNull();
    expect(redeemIfSufficient(db, reward.id)).toBeNull(); // balance is now 0, second call must fail
    expect(getXpBalance(db)).toBe(0); // unchanged by the rejected second call
    expect(countRedemptions(db)).toBe(1);
  });

  it('throws when redeeming a reward that does not exist', () => {
    const db = createTestDb();
    expect(() => redeemIfSufficient(db, 'nope')).toThrow(/no encontrada/);
  });

  it('getRewardById returns null for a missing id', () => {
    const db = createTestDb();
    expect(getRewardById(db, 'nope')).toBeNull();
  });

  it('updates name/cost/rarity but ignores rarity for non-chest_item types', () => {
    const db = createTestDb();
    const reward = insertReward(db, { type: 'shop', name: 'a', xpCost: 10, rarity: null });
    const updated = updateReward(db, reward.id, { name: 'b', xpCost: 25, rarity: 'epic' });
    expect(updated).toMatchObject({ name: 'b', xp_cost: 25, rarity: null });
  });

  it('updates rarity for chest_item rewards', () => {
    const db = createTestDb();
    const reward = insertReward(db, { type: 'chest_item', name: 'sword', xpCost: 5, rarity: 'common' });
    const updated = updateReward(db, reward.id, { name: 'sword', xpCost: 5, rarity: 'epic' });
    expect(updated.rarity).toBe('epic');
  });

  it('throws when updating a reward that does not exist', () => {
    const db = createTestDb();
    expect(() => updateReward(db, 'nope', { name: 'x', xpCost: 1, rarity: null })).toThrow(/no encontrada/);
  });

  it('rejects insertReward with a non-integer cost', () => {
    const db = createTestDb();
    expect(() => insertReward(db, { type: 'shop', name: 'a', xpCost: 1.5, rarity: null })).toThrow(/costo invalido/);
  });

  it('deletes a reward with no redemption history', () => {
    const db = createTestDb();
    const reward = insertReward(db, { type: 'shop', name: 'a', xpCost: 10, rarity: null });
    deleteReward(db, reward.id);
    expect(getRewardById(db, reward.id)).toBeNull();
  });

  it('deletes a chest along with its chest_contents links', () => {
    const db = createTestDb();
    const chest = insertReward(db, { type: 'chest', name: 'Case A', xpCost: 50, rarity: null });
    const item = insertReward(db, { type: 'chest_item', name: 'skin', xpCost: 5, rarity: 'common' });
    addChestContents(db, chest.id, item.id);

    expect(() => deleteReward(db, chest.id)).not.toThrow();
    expect(getRewardById(db, chest.id)).toBeNull();
    expect(listChestContents(db)).toHaveLength(0);
  });

  it('refuses to delete a reward that has been redeemed', () => {
    const db = createTestDb();
    incrementXpBalance(db, 10);
    const reward = insertReward(db, { type: 'shop', name: 'a', xpCost: 10, rarity: null });
    redeemIfSufficient(db, reward.id);
    expect(() => deleteReward(db, reward.id)).toThrow(/ya fue canjeada/);
    expect(getRewardById(db, reward.id)).not.toBeNull();
  });

  it('throws when deleting a reward that does not exist', () => {
    const db = createTestDb();
    expect(() => deleteReward(db, 'nope')).toThrow(/no encontrada/);
  });

  it('lists redemptions with the snapshotted reward name, newest first', () => {
    const db = createTestDb();
    incrementXpBalance(db, 100);
    const coffee = insertReward(db, { type: 'shop', name: 'coffee', xpCost: 10, rarity: null });
    const nap = insertReward(db, { type: 'shop', name: 'nap', xpCost: 20, rarity: null });
    redeemIfSufficient(db, coffee.id);
    redeemIfSufficient(db, nap.id);

    const rows = listRedemptions(db);
    expect(rows.map((r) => r.reward_name)).toEqual(['nap', 'coffee']);
    expect(rows[0].xp_spent).toBe(20);
  });

  it('keeps the redemption name it had the day it happened when the reward is renamed', () => {
    const db = createTestDb();
    incrementXpBalance(db, 100);
    const coffee = insertReward(db, { type: 'shop', name: 'coffee', xpCost: 10, rarity: null });
    redeemIfSufficient(db, coffee.id);

    updateReward(db, coffee.id, { name: 'espresso doble', xpCost: 10, rarity: null });

    expect(listRedemptions(db)[0].reward_name).toBe('coffee');
  });

  it('records which item came out of a chest', () => {
    const db = createTestDb();
    incrementXpBalance(db, 100);
    const chest = insertReward(db, { type: 'chest', name: 'Case A', xpCost: 50, rarity: null });
    const skin = insertReward(db, { type: 'chest_item', name: 'AK | Redline', xpCost: 1, rarity: 'rare' });

    redeemIfSufficient(db, chest.id, { id: skin.id, name: skin.name, rarity: 'rare', image: 'x.png' });

    const row = listRedemptions(db)[0];
    expect(row.won_item_id).toBe(skin.id);
    expect(row.won_item_name).toBe('AK | Redline');
    expect(row.won_item_rarity).toBe('rare');
    expect(row.won_item_image).toBe('x.png');
  });

  it('leaves the won item null for a shop redemption', () => {
    const db = createTestDb();
    incrementXpBalance(db, 100);
    const coffee = insertReward(db, { type: 'shop', name: 'coffee', xpCost: 10, rarity: null });
    redeemIfSufficient(db, coffee.id);

    expect(listRedemptions(db)[0].won_item_name).toBeNull();
  });

  describe('chest_contents', () => {
    it('scopes getChestPool to only the items linked to that chest', () => {
      const db = createTestDb();
      const chestA = insertReward(db, { type: 'chest', name: 'Case A', xpCost: 50, rarity: null });
      const chestB = insertReward(db, { type: 'chest', name: 'Case B', xpCost: 80, rarity: null });
      const itemA = insertReward(db, { type: 'chest_item', name: 'Skin A', xpCost: 1, rarity: 'common' });
      const itemB = insertReward(db, { type: 'chest_item', name: 'Skin B', xpCost: 1, rarity: 'rare' });

      addChestContents(db, chestA.id, itemA.id);
      addChestContents(db, chestB.id, itemB.id);

      expect(getChestPool(db, chestA.id).map((r) => r.name)).toEqual(['Skin A']);
      expect(getChestPool(db, chestB.id).map((r) => r.name)).toEqual(['Skin B']);
    });

    it('allows the same item in more than one chest without erroring twice', () => {
      const db = createTestDb();
      const chest = insertReward(db, { type: 'chest', name: 'Case A', xpCost: 50, rarity: null });
      const item = insertReward(db, { type: 'chest_item', name: 'Skin A', xpCost: 1, rarity: 'common' });

      addChestContents(db, chest.id, item.id);
      expect(() => addChestContents(db, chest.id, item.id)).not.toThrow();
      expect(getChestPool(db, chest.id)).toHaveLength(1);
    });

    it('returns an empty pool for a chest with no linked items', () => {
      const db = createTestDb();
      const chest = insertReward(db, { type: 'chest', name: 'Empty Case', xpCost: 50, rarity: null });
      expect(getChestPool(db, chest.id)).toEqual([]);
    });

    it('listChestContents returns every link across all chests', () => {
      const db = createTestDb();
      const chestA = insertReward(db, { type: 'chest', name: 'Case A', xpCost: 50, rarity: null });
      const itemA = insertReward(db, { type: 'chest_item', name: 'Skin A', xpCost: 1, rarity: 'common' });
      addChestContents(db, chestA.id, itemA.id);

      expect(listChestContents(db)).toEqual([{ chestId: chestA.id, chestItemId: itemA.id }]);
    });
  });

  it('stores image and rarity_color on insert, defaulting to null', () => {
    const db = createTestDb();
    const withImage = insertReward(db, {
      type: 'chest_item', name: 'Skin', xpCost: 1, rarity: 'common',
      image: 'https://example.com/a.png', rarityColor: '#4b69ff',
    });
    expect(withImage.image).toBe('https://example.com/a.png');
    expect(withImage.rarity_color).toBe('#4b69ff');

    const withoutImage = insertReward(db, { type: 'shop', name: 'Coffee', xpCost: 10, rarity: null });
    expect(withoutImage.image).toBeNull();
    expect(withoutImage.rarity_color).toBeNull();
  });
});

describe('listInventory', () => {
  function chestWith(db: ReturnType<typeof createTestDb>) {
    incrementXpBalance(db, 1000);
    return insertReward(db, { type: 'chest', name: 'Case A', xpCost: 10, rarity: null });
  }

  it('is empty before anything was opened', () => {
    expect(listInventory(createTestDb())).toEqual([]);
  });

  it('groups repeated drops of the same item into one row with a count', () => {
    const db = createTestDb();
    const chest = chestWith(db);
    const skin = insertReward(db, { type: 'chest_item', name: 'AK | Redline', xpCost: 1, rarity: 'rare' });
    const won = { id: skin.id, name: skin.name, rarity: 'rare', image: 'ak.png' };

    redeemIfSufficient(db, chest.id, won);
    redeemIfSufficient(db, chest.id, won);

    const rows = listInventory(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(2);
    expect(rows[0].name).toBe('AK | Redline');
    expect(rows[0].rarity).toBe('rare');
    expect(rows[0].image).toBe('ak.png');
  });

  it('orders by how many you hold, most first', () => {
    const db = createTestDb();
    const chest = chestWith(db);
    const one = insertReward(db, { type: 'chest_item', name: 'one', xpCost: 1, rarity: 'common' });
    const many = insertReward(db, { type: 'chest_item', name: 'many', xpCost: 1, rarity: 'common' });

    redeemIfSufficient(db, chest.id, { id: one.id, name: 'one', rarity: 'common' });
    redeemIfSufficient(db, chest.id, { id: many.id, name: 'many', rarity: 'common' });
    redeemIfSufficient(db, chest.id, { id: many.id, name: 'many', rarity: 'common' });

    expect(listInventory(db).map((r) => r.name)).toEqual(['many', 'one']);
  });

  // Los canjes de tienda y los previos al snapshot no dejaron objeto: no son inventario.
  it('leaves out redemptions that carry no won item', () => {
    const db = createTestDb();
    incrementXpBalance(db, 1000);
    const coffee = insertReward(db, { type: 'shop', name: 'coffee', xpCost: 10, rarity: null });
    redeemIfSufficient(db, coffee.id);

    expect(listInventory(db)).toEqual([]);
  });
});

describe('selling an item back', () => {
  function ownOne(db: ReturnType<typeof createTestDb>, name = 'AK | Redline') {
    incrementXpBalance(db, 1000);
    const chest = insertReward(db, { type: 'chest', name: 'Case A', xpCost: 10, rarity: null });
    const skin = insertReward(db, { type: 'chest_item', name, xpCost: 1, rarity: 'rare' });
    redeemIfSufficient(db, chest.id, { id: skin.id, name, rarity: 'rare', image: 'ak.png' });
    return skin;
  }

  it('credits the xp and takes the item out of the inventory', () => {
    const db = createTestDb();
    const skin = ownOne(db);
    const before = getXpBalance(db);

    const sale = sellOneItem(db, skin.id, 42, 105);

    expect(sale?.xp_credited).toBe(42);
    expect(getXpBalance(db)).toBe(before + 42);
    expect(listInventory(db)).toEqual([]);
  });

  it('leaves the redemption untouched: the past is not rewritten', () => {
    const db = createTestDb();
    const skin = ownOne(db);
    sellOneItem(db, skin.id, 42, 105);

    // El canje sigue diciendo lo que salio ese dia, aunque el objeto ya no este.
    expect(listRedemptions(db)[0].won_item_name).toBe('AK | Redline');
    expect(listSales(db)).toHaveLength(1);
  });

  it('refuses to sell the same unit twice', () => {
    const db = createTestDb();
    const skin = ownOne(db);

    expect(sellOneItem(db, skin.id, 42, 105)).not.toBeNull();
    const second = sellOneItem(db, skin.id, 42, 105);

    expect(second).toBeNull();
    expect(listSales(db)).toHaveLength(1);
  });

  it('keeps the leftovers when you own more than one', () => {
    const db = createTestDb();
    const skin = ownOne(db);
    const chest = listRewards(db).find((r) => r.type === 'chest')!;
    redeemIfSufficient(db, chest.id, { id: skin.id, name: skin.name, rarity: 'rare', image: 'ak.png' });

    expect(listInventory(db)[0].count).toBe(2);
    sellOneItem(db, skin.id, 42, 105);
    expect(listInventory(db)[0].count).toBe(1);
  });

  it('refuses to sell something that was never won', () => {
    const db = createTestDb();
    expect(sellOneItem(db, 'nunca-lo-tuve', 42, 105)).toBeNull();
  });

  // La llave se cobra ademas del precio de la caja, y el ledger tiene que reflejar el
  // total que salio del bolsillo.
  it('charges the key on top and records the full amount spent', () => {
    const db = createTestDb();
    incrementXpBalance(db, 100);
    const chest = insertReward(db, { type: 'chest', name: 'Case A', xpCost: 10, rarity: null });

    redeemIfSufficient(db, chest.id, undefined, 8);

    expect(getXpBalance(db)).toBe(82);
    expect(listRedemptions(db)[0].xp_spent).toBe(18);
  });

  it('refuses the opening when the balance covers the case but not the key', () => {
    const db = createTestDb();
    incrementXpBalance(db, 10);
    const chest = insertReward(db, { type: 'chest', name: 'Case A', xpCost: 10, rarity: null });

    expect(redeemIfSufficient(db, chest.id, undefined, 8)).toBeNull();
    expect(getXpBalance(db)).toBe(10);
  });
});
