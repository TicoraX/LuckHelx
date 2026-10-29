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
  rotateProvablyFairSeed,
  UPGRADE_MAX_PROBABILITY,
  UPGRADE_MIN_PROBABILITY,
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

  it('lists upgrade targets with consistent priceUsd and valueCents', () => {
    const db = createTestDb();
    const target = insertReward(db, {
      name: 'AK-47 | Redline',
      type: 'chest_item',
      xpCost: 1500,
      rarity: 'rare',
      image: null,
    });
    setSkinPrice(db, 'AK-47 | Redline', 12.5, null);

    const targets = listUpgradeTargets(db, 10);
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe(target.id);
    expect(targets[0].priceUsd).toBe(12.5);
    expect(targets[0].valueCents).toBe(1250);
  });
});
