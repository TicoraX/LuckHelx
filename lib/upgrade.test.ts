import { describe, expect, it } from 'vitest';
import { createTestDb } from './db';
import { insertReward, listInventory } from './rewards-store';
import { getXpBalance, incrementXpBalance } from './settings-store';
import { setSkinPrice } from './skin-prices';
import {
  calculateUpgradeOdds,
  executeUpgrade,
  generateProvablyFairRoll,
  generateServerSeed,
  getActiveProvablyFairSeed,
  getLastRevealedSeed,
  hashServerSeed,
  listUpgrades,
  listUpgradeTargets,
  nearestTarget,
  rotateProvablyFairSeed,
  UPGRADE_MAX_PROBABILITY,
  UPGRADE_MIN_PROBABILITY,
  valueCentsOf,
  verifyProvablyFairRoll,
} from './upgrade';

describe('Upgrade Domain & Mathematics', () => {
  it('calculates standard odds transparently with house edge', () => {
    // $10.00 in, $20.00 target, 5% edge:
    // P = 1000 / (2000 * 1.05) = 1000 / 2100 = 0.47619... -> 47.62%
    const calc = calculateUpgradeOdds(1000, 2000, 0.05, 'under');
    expect(calc.winPercentage).toBe(47.62);
    expect(calc.sectorStartAngle).toBe(0);
    expect(calc.sectorSpanAngle).toBe(171.43);
    expect(calc.sectorEndAngle).toBe(171.43);
    expect(calc.multiplier).toBe(2);
  });

  it('calculates over sector correctly', () => {
    const calc = calculateUpgradeOdds(1000, 2000, 0.05, 'over');
    expect(calc.sectorMode).toBe('over');
    expect(calc.sectorEndAngle).toBe(360);
    expect(calc.sectorStartAngle).toBe(360 - 171.43);
  });

  it('clamps probability to a maximum of 95% even when overcollateralized', () => {
    // $50.00 in, $20.00 out -> raw ratio > 2.0
    const calc = calculateUpgradeOdds(5000, 2000, 0.05);
    expect(calc.probability).toBe(UPGRADE_MAX_PROBABILITY);
    expect(calc.winPercentage).toBe(95);
    expect(calc.sectorSpanAngle).toBe(342); // 95% of 360
  });

  it('clamps probability to a minimum of 0.01% for extreme shots', () => {
    // 1 cent in, $1,000.00 out
    const calc = calculateUpgradeOdds(1, 100000, 0.05);
    expect(calc.probability).toBe(UPGRADE_MIN_PROBABILITY);
    expect(calc.winPercentage).toBe(0.01);
  });

  it('throws when inputs or targets are zero or negative', () => {
    expect(() => calculateUpgradeOdds(0, 1000)).toThrow(/inputValueCents/);
    expect(() => calculateUpgradeOdds(100, 0)).toThrow(/targetValueCents/);
  });
});

describe('Provably Fair Cryptographic Engine', () => {
  it('generates valid 64-char hex server seeds and hashes them with sha256', () => {
    const seed = generateServerSeed();
    expect(seed).toHaveLength(64);
    const hash = hashServerSeed(seed);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashServerSeed(seed));
  });

  it('produces strictly deterministic rolls with uniform range [0, 100) and [0, 360)', () => {
    const serverSeed = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const clientSeed = 'custom_client_123';
    const nonce = 1;

    const roll1 = generateProvablyFairRoll(serverSeed, clientSeed, nonce, 180, 'under');
    const roll2 = generateProvablyFairRoll(serverSeed, clientSeed, nonce, 180, 'under');

    expect(roll1.hmacHash).toBe(roll2.hmacHash);
    expect(roll1.rollFloat).toBe(roll2.rollFloat);
    expect(roll1.rollAngle).toBe(roll2.rollAngle);
    expect(roll1.isWin).toBe(roll2.isWin);

    expect(roll1.rollAngle).toBeGreaterThanOrEqual(0);
    expect(roll1.rollAngle).toBeLessThan(360);
  });

  it('verifies valid rolls and rejects tampered seeds or angles', () => {
    const serverSeed = generateServerSeed();
    const clientSeed = 'my_seed';
    const nonce = 5;

    const roll = generateProvablyFairRoll(serverSeed, clientSeed, nonce, 180);
    const valid = verifyProvablyFairRoll(
      serverSeed,
      clientSeed,
      nonce,
      roll.hmacHash,
      roll.rollAngle
    );
    expect(valid).toBe(true);

    const tampered = verifyProvablyFairRoll(
      serverSeed,
      'wrong_client',
      nonce,
      roll.hmacHash,
      roll.rollAngle
    );
    expect(tampered).toBe(false);
  });
});

describe('Atomic Upgrade Execution (SQLite & Ledgers)', () => {
  function setupUpgradeEnv() {
    const db = createTestDb();
    incrementXpBalance(db, 20000); // 200.00 XP

    // Skin 1: Input skin
    const inputSkin = insertReward(db, {
      type: 'chest_item',
      name: 'AK-47 | Slate',
      xpCost: 280,
      rarity: 'rare',
    });

    // Skin 2: Target skin
    const targetSkin = insertReward(db, {
      type: 'chest_item',
      name: 'AWP | Asiimov',
      xpCost: 4500,
      rarity: 'epic',
    });

    setSkinPrice(db, inputSkin.name, 2.8, 'Field-Tested');
    setSkinPrice(db, targetSkin.name, 45.0, 'Field-Tested');

    // Simulate winning inputSkin into user's inventory
    db.prepare(
      `INSERT INTO redemptions (id, reward_id, xp_spent, won_item_id, won_item_name, won_item_rarity)
       VALUES ('init-redemption-1', ?, 0, ?, ?, ?)`
    ).run(inputSkin.id, inputSkin.id, inputSkin.name, inputSkin.rarity);

    return { db, inputSkin, targetSkin };
  }

  it('rejects upgrade when target skin does not exist', () => {
    const { db } = setupUpgradeEnv();
    expect(() =>
      executeUpgrade(db, {
        targetItemId: 'non_existent_target',
        xpSpentCents: 500,
      })
    ).toThrow(/Skin objetivo no encontrada/);
  });

  it('rejects upgrade when user lacks direct XP balance', () => {
    const { db, targetSkin } = setupUpgradeEnv();
    expect(() =>
      executeUpgrade(db, {
        targetItemId: targetSkin.id,
        xpSpentCents: 9999999, // Exceeds balance
      })
    ).toThrow(/Saldo de XP insuficiente/);
  });

  it('rejects upgrade when input skin is not in inventory', () => {
    const { db, targetSkin } = setupUpgradeEnv();
    expect(() =>
      executeUpgrade(db, {
        targetItemId: targetSkin.id,
        inputItemIds: ['unowned-skin-id'],
      })
    ).toThrow(/Ítem de entrada no encontrado/);
  });

  it('executes atomic upgrade, increments nonce, and burns input skin', () => {
    const { db, inputSkin, targetSkin } = setupUpgradeEnv();
    const balanceBefore = getXpBalance(db);

    const result = executeUpgrade(db, {
      targetItemId: targetSkin.id,
      inputItemIds: [inputSkin.id],
      xpSpentCents: 500, // 5.00 XP
      sectorMode: 'under',
      clientSeed: 'test_client_seed',
    });

    expect(result.upgradeId).toBeTruthy();
    expect(['won', 'lost']).toContain(result.outcome);
    expect(result.totalInCents).toBe(280 + 500); // 2.80 + 5.00 = 780 cents
    expect(result.targetItem.id).toBe(targetSkin.id);
    expect(result.provablyFair.nonce).toBe(1);

    // Balance deducted exactly xpSpentCents
    expect(getXpBalance(db)).toBe(balanceBefore - 500);

    // Input skin must be burned (no longer available in inventory)
    const inventory = listInventory(db);
    const inputSkinOwned = inventory.find((i) => i.id === inputSkin.id);
    expect(inputSkinOwned).toBeUndefined();

    // If won, target skin must now be in inventory!
    if (result.outcome === 'won') {
      const targetSkinOwned = inventory.find((i) => i.id === targetSkin.id);
      expect(targetSkinOwned).toBeDefined();
      expect(targetSkinOwned?.count).toBe(1);
    }

    // Upgrade row must be logged in inmutable upgrades table
    const history = listUpgrades(db);
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(result.upgradeId);
    expect(history[0].outcome).toBe(result.outcome);
    expect(history[0].nonce).toBe(1);

    // Second execution increments nonce to 2
    const result2 = executeUpgrade(db, {
      targetItemId: targetSkin.id,
      xpSpentCents: 100,
    });
    expect(result2.provablyFair.nonce).toBe(2);

    // La semilla sigue activa: con ella cualquiera calcula la tirada siguiente.
    expect(result2.provablyFair).not.toHaveProperty('serverSeed');
    for (const row of listUpgrades(db)) expect(row).not.toHaveProperty('server_seed');
  });

  it('rotating reveals the seed that signed past rolls and opens a fresh one', () => {
    const { db, targetSkin } = setupUpgradeEnv();
    const first = executeUpgrade(db, { targetItemId: targetSkin.id, xpSpentCents: 100 });
    const second = executeUpgrade(db, { targetItemId: targetSkin.id, xpSpentCents: 100 });
    expect(getLastRevealedSeed(db)).toBeNull();

    const { revealed, nextSeedHash } = rotateProvablyFairSeed(db);

    // La semilla revelada es la del compromiso publicado y reproduce cada tirada firmada.
    expect(hashServerSeed(revealed.serverSeed)).toBe(first.provablyFair.serverSeedHash);
    expect(revealed.finalNonce).toBe(2);
    for (const roll of [first, second]) {
      const pf = roll.provablyFair;
      expect(
        verifyProvablyFairRoll(
          revealed.serverSeed,
          pf.clientSeed,
          pf.nonce,
          pf.hmacHash,
          pf.rollAngle
        )
      ).toBe(true);
    }
    expect(getLastRevealedSeed(db)).toEqual(revealed);

    // Una sola activa, nueva, desde nonce 0.
    const active = getActiveProvablyFairSeed(db);
    expect(active.serverSeedHash).toBe(nextSeedHash);
    expect(nextSeedHash).not.toBe(revealed.serverSeedHash);
    expect(active.currentNonce).toBe(0);
    const actives = db
      .prepare("SELECT COUNT(*) AS c FROM provably_fair_seeds WHERE status = 'active'")
      .get() as { c: number };
    expect(actives.c).toBe(1);

    const third = executeUpgrade(db, { targetItemId: targetSkin.id, xpSpentCents: 100 });
    expect(third.provablyFair.serverSeedHash).toBe(nextSeedHash);
    expect(third.provablyFair.nonce).toBe(1);
  });

  it('rejects a target worth <= the entry or > 100x, leaving inventory, XP and nonce intact', () => {
    const { db, inputSkin, targetSkin } = setupUpgradeEnv();
    const cheap = insertReward(db, {
      type: 'chest_item',
      name: 'Cheap',
      xpCost: 1,
      rarity: 'rare',
    });
    const huge = insertReward(db, { type: 'chest_item', name: 'Huge', xpCost: 1, rarity: 'epic' });
    setSkinPrice(db, 'Cheap', 2.8, null); // igual a la entrada
    setSkinPrice(db, 'Huge', 300, null); // 30000 > 100 x 280
    const before = {
      xp: getXpBalance(db),
      inv: listInventory(db).length,
      nonce: getActiveProvablyFairSeed(db).currentNonce,
    };
    for (const t of [cheap, huge]) {
      expect(() =>
        executeUpgrade(db, { targetItemId: t.id, inputItemIds: [inputSkin.id] })
      ).toThrow();
      expect(() => executeUpgrade(db, { targetItemId: t.id, xpSpentCents: 280 })).toThrow();
    }
    expect(getXpBalance(db)).toBe(before.xp);
    expect(listInventory(db)).toHaveLength(before.inv);
    expect(getActiveProvablyFairSeed(db).currentNonce).toBe(before.nonce);
    const ok = executeUpgrade(db, { targetItemId: targetSkin.id, inputItemIds: [inputSkin.id] });
    expect(ok.provablyFair.nonce).toBe(before.nonce + 1);
  });
});

describe('valueCentsOf', () => {
  it('uses real price when > 0, otherwise the deterministic one, floor 1 cent', () => {
    expect(valueCentsOf(12.5, 'X', 'rare')).toBe(1250);
    expect(valueCentsOf(0.001, 'X', 'rare')).toBe(1);
    expect(valueCentsOf(null, 'X', 'rare')).toBe(valueCentsOf(0, 'X', 'rare'));
    expect(valueCentsOf(undefined, 'X', 'rare')).toBeGreaterThan(0);
  });
});

describe('listUpgradeTargets / nearestTarget', () => {
  function seed(prices: Record<string, number>) {
    const db = createTestDb();
    for (const [name, usd] of Object.entries(prices)) {
      insertReward(db, { type: 'chest_item', name, xpCost: 100, rarity: 'rare' });
      setSkinPrice(db, name, usd, null);
    }
    return db;
  }

  it('only offers targets in (1.1x, 20x] of the entry', () => {
    const db = seed({ a: 0.5, b: 1.0, c: 1.1, d: 1.11, e: 5, f: 20, g: 20.01, h: 100 });
    const { items, total, maxValueCents } = listUpgradeTargets(db, { entryCents: 100 });
    expect(items.map((i) => i.name)).toEqual(['d', 'e', 'f']);
    expect(total).toBe(3);
    expect(maxValueCents).toBe(10000);
    for (const i of items) {
      expect(i.valueCents).toBeGreaterThan(110);
      expect(i.valueCents).toBeLessThanOrEqual(2000);
    }
  });

  it('dedupes by name and returns empty for entry 0', () => {
    const db = seed({ dup: 5 });
    insertReward(db, { type: 'chest_item', name: 'dup', xpCost: 100, rarity: 'rare' });
    expect(listUpgradeTargets(db, { entryCents: 100 }).items).toHaveLength(1);
    expect(listUpgradeTargets(db, { entryCents: 0 })).toEqual({
      items: [],
      total: 0,
      maxValueCents: 0,
    });
  });

  it('samples by quantiles when over the limit, keeping both ends of the range', () => {
    const prices: Record<string, number> = {};
    for (let i = 0; i < 100; i++) prices[`s${i}`] = 1.2 + i * 0.1; // 120..1110 cents
    const db = seed(prices);
    const { items, total } = listUpgradeTargets(db, { entryCents: 100, limit: 10 });
    expect(items).toHaveLength(10);
    expect(total).toBe(100);
    expect(items[0].name).toBe('s0');
    expect(items[9].name).toBe('s99');
    expect(items.map((i) => i.valueCents)).toEqual(
      items.map((i) => i.valueCents).sort((x, y) => x - y)
    );
  });

  it('filters q by case-insensitive substring', () => {
    const db = seed({ 'AK-47 | Redline': 5, 'AWP | Asiimov': 5 });
    const r = listUpgradeTargets(db, { entryCents: 100, q: 'redLINE' });
    expect(r.items.map((i) => i.name)).toEqual(['AK-47 | Redline']);
    expect(r.total).toBe(1);
  });

  it('flags priceIsFallback only without a real price row', () => {
    const db = seed({ real: 5 });
    insertReward(db, { type: 'chest_item', name: 'guess', xpCost: 100, rarity: 'rare' });
    const v = valueCentsOf(null, 'guess', 'rare');
    const { items } = listUpgradeTargets(db, { entryCents: Math.floor(v / 5) });
    expect(items.find((i) => i.name === 'real')?.priceIsFallback).toBe(false);
    expect(items.find((i) => i.name === 'guess')?.priceIsFallback).toBe(true);
    expect(items.find((i) => i.name === 'real')?.priceUsd).toBe(5);
  });

  it('nearestTarget picks the closest, ties go to the lower value, empty gives null', () => {
    const mk = (valueCents: number) => ({
      id: String(valueCents),
      name: 'n',
      rarity: null,
      image: null,
      priceUsd: 0,
      valueCents,
      priceIsFallback: false,
    });
    expect(nearestTarget([mk(100), mk(190), mk(500)], 200)?.valueCents).toBe(190);
    expect(nearestTarget([mk(150), mk(250)], 200)?.valueCents).toBe(150);
    expect(nearestTarget([mk(250), mk(150)], 200)?.valueCents).toBe(150);
    expect(nearestTarget([], 200)).toBeNull();
  });
});
