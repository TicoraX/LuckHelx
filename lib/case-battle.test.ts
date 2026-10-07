import { describe, expect, it } from "vitest";
import {
	BOTS,
	executeCaseBattle,
	getBattleItemValue,
	listCaseBattles,
} from "./case-battle";
import { createTestDb } from "./db";
import { addChestContents, insertReward, listInventory } from "./rewards-store";
import { getXpBalance, incrementXpBalance } from "./settings-store";
import { setSkinPrice } from "./skin-prices";

describe("case-battle domain", () => {
	function setupTestScenario() {
		const db = createTestDb();
		// Default key cost is 0 or configured in settings; let's check balance
		incrementXpBalance(db, 10000); // 100 XP

		const chest = insertReward(db, {
			type: "chest",
			name: "Dreams & Nightmares Case",
			xpCost: 200, // 2.00 XP
			rarity: null,
		});

		const commonSkin = insertReward(db, {
			type: "chest_item",
			name: "P250 | Cyber Shell",
			xpCost: 50,
			rarity: "common",
		});

		const rareSkin = insertReward(db, {
			type: "chest_item",
			name: "AK-47 | Nightwish",
			xpCost: 500,
			rarity: "rare",
		});

		const legendarySkin = insertReward(db, {
			type: "chest_item",
			name: "★ Butterfly Knife | Lore",
			xpCost: 50000,
			rarity: "legendary",
		});

		addChestContents(db, chest.id, commonSkin.id);
		addChestContents(db, chest.id, rareSkin.id);
		addChestContents(db, chest.id, legendarySkin.id);

		// Set prices in skin_prices cache
		setSkinPrice(db, commonSkin.name, 0.45, "Field-Tested");
		setSkinPrice(db, rareSkin.name, 12.5, "Field-Tested");
		setSkinPrice(db, legendarySkin.name, 1200.0, null);

		return { db, chest, commonSkin, rareSkin, legendarySkin };
	}

	it("rejects battle execution if user balance is insufficient", () => {
		const { db, chest } = setupTestScenario();
		// Set balance to 100, while chest cost + key is at least 200
		db.prepare("UPDATE meta SET value = ? WHERE key = ?").run(
			"100",
			"xp_balance",
		);

		expect(() => {
			executeCaseBattle(db, { chestId: chest.id });
		}).toThrow(/XP insuficiente/);

		expect(getXpBalance(db)).toBe(100);
		expect(listCaseBattles(db)).toHaveLength(0);
	});

	it("throws when chest does not exist or has no pool items", () => {
		const { db } = setupTestScenario();

		expect(() => {
			executeCaseBattle(db, { chestId: "non-existent" });
		}).toThrow(/cofre no encontrado/);

		const emptyChest = insertReward(db, {
			type: "chest",
			name: "Empty Case",
			xpCost: 100,
			rarity: null,
		});

		expect(() => {
			executeCaseBattle(db, { chestId: emptyChest.id });
		}).toThrow(/no hay objetos definidos/);
	});

	it("player win: credits 2 skins to inventory and records battle", () => {
		const { db, chest, legendarySkin, commonSkin } = setupTestScenario();
		const initialBalance = getXpBalance(db);

		const result = executeCaseBattle(db, {
			chestId: chest.id,
			botId: "bot-clucky",
			overridePlayerItem: {
				id: legendarySkin.id,
				name: legendarySkin.name,
				rarity: "legendary",
			},
			overrideBotItem: {
				id: commonSkin.id,
				name: commonSkin.name,
				rarity: "common",
			},
		});

		expect(result.winner).toBe("player");
		expect(result.bot.id).toBe("bot-clucky");
		expect(result.playerItem.id).toBe(legendarySkin.id);
		expect(result.botItem.id).toBe(commonSkin.id);
		expect(result.playerItem.valueUsd).toBe(1200.0);
		expect(result.botItem.valueUsd).toBe(0.45);

		// Balance deducted exactly totalCost
		expect(getXpBalance(db)).toBe(initialBalance - result.xpSpent);

		// Inventory must now contain BOTH items!
		const inventory = listInventory(db);
		expect(inventory).toHaveLength(2);

		const wonPlayerSkin = inventory.find((i) => i.id === legendarySkin.id);
		const wonBotSkin = inventory.find((i) => i.id === commonSkin.id);

		expect(wonPlayerSkin).toBeDefined();
		expect(wonPlayerSkin?.count).toBe(1);
		expect(wonBotSkin).toBeDefined();
		expect(wonBotSkin?.count).toBe(1);

		// Battle history is recorded
		const battles = listCaseBattles(db);
		expect(battles).toHaveLength(1);
		expect(battles[0].winner).toBe("player");
		expect(battles[0].chest_id).toBe(chest.id);
		expect(battles[0].bot_id).toBe("bot-clucky");
	});

	it("bot win: player loses both items and receives 0 skins in inventory", () => {
		const { db, chest, legendarySkin, commonSkin } = setupTestScenario();
		const initialBalance = getXpBalance(db);

		const result = executeCaseBattle(db, {
			chestId: chest.id,
			botId: "bot-gaben",
			overridePlayerItem: {
				id: commonSkin.id,
				name: commonSkin.name,
				rarity: "common",
			},
			overrideBotItem: {
				id: legendarySkin.id,
				name: legendarySkin.name,
				rarity: "legendary",
			},
		});

		expect(result.winner).toBe("bot");
		expect(result.bot.name).toBe("Lord Gaben");

		// Balance was deducted
		expect(getXpBalance(db)).toBe(initialBalance - result.xpSpent);

		// Inventory receives ZERO skins
		const inventory = listInventory(db);
		expect(inventory).toHaveLength(0);

		// Battle history shows bot winner
		const battles = listCaseBattles(db);
		expect(battles).toHaveLength(1);
		expect(battles[0].winner).toBe("bot");
	});

	it("tie: player keeps their own item (credits exactly 1 skin to inventory)", () => {
		const { db, chest, commonSkin } = setupTestScenario();
		const initialBalance = getXpBalance(db);

		const result = executeCaseBattle(db, {
			chestId: chest.id,
			botId: "bot-neo",
			overridePlayerItem: {
				id: commonSkin.id,
				name: commonSkin.name,
				rarity: "common",
			},
			overrideBotItem: {
				id: commonSkin.id,
				name: commonSkin.name,
				rarity: "common",
			},
		});

		expect(result.winner).toBe("tie");
		expect(getXpBalance(db)).toBe(initialBalance - result.xpSpent);

		// Inventory receives player's skin (1 skin)
		const inventory = listInventory(db);
		expect(inventory).toHaveLength(1);
		expect(inventory[0].id).toBe(commonSkin.id);
		expect(inventory[0].count).toBe(1);

		const battles = listCaseBattles(db);
		expect(battles).toHaveLength(1);
		expect(battles[0].winner).toBe("tie");
	});

	it("idempotency: reusing operationId returns identical cached battle without re-charging", () => {
		const { db, chest, rareSkin, commonSkin } = setupTestScenario();
		const initialBalance = getXpBalance(db);
		const operationId = "op-battle-12345";

		const firstRun = executeCaseBattle(db, {
			chestId: chest.id,
			operationId,
			overridePlayerItem: {
				id: rareSkin.id,
				name: rareSkin.name,
				rarity: "rare",
			},
			overrideBotItem: {
				id: commonSkin.id,
				name: commonSkin.name,
				rarity: "common",
			},
		});

		const balanceAfterFirst = getXpBalance(db);
		expect(balanceAfterFirst).toBe(initialBalance - firstRun.xpSpent);

		// Second call with same operationId
		const secondRun = executeCaseBattle(db, {
			chestId: chest.id,
			operationId,
		});

		expect(secondRun.battleId).toBe(operationId);
		expect(secondRun.winner).toBe(firstRun.winner);
		expect(secondRun.playerItem.id).toBe(firstRun.playerItem.id);
		expect(secondRun.botItem.id).toBe(firstRun.botItem.id);

		// Balance was NOT deducted a second time!
		expect(getXpBalance(db)).toBe(balanceAfterFirst);

		// History contains only 1 row
		expect(listCaseBattles(db)).toHaveLength(1);
	});

	it("falls back to tier average value when skin price is not in skin_prices", () => {
		const db = createTestDb();
		expect(getBattleItemValue(db, "Unknown Knife", "legendary")).toBe(80.0);
		expect(getBattleItemValue(db, "Unknown Rifle", "epic")).toBe(15.0);
		expect(getBattleItemValue(db, "Unknown SMG", "rare")).toBe(2.0);
		expect(getBattleItemValue(db, "Unknown Pistol", "common")).toBe(0.5);
		expect(getBattleItemValue(db, "Unknown Other", null)).toBe(0.5);
	});

	it("handles random bot selection and random drop picking when overrides are omitted", () => {
		const { db, chest } = setupTestScenario();

		const result = executeCaseBattle(db, {
			chestId: chest.id,
		});

		expect(result.battleId).toBeTruthy();
		expect(BOTS.map((b) => b.id)).toContain(result.bot.id);
		expect(["player", "bot", "tie"]).toContain(result.winner);
	});
});
