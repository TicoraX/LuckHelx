import { randomUUID } from "crypto";
import type { Db } from "./db";
import { type ChestItem, pickChestItem } from "./rewards";
import { getChestPool, getRewardById } from "./rewards-store";
import {
	getSaleEconomy,
	getXpBalance,
	incrementXpBalance,
} from "./settings-store";
import { formatXp } from "./xp";

export interface CaseBattleBot {
	id: string;
	name: string;
	title: string;
	avatar: string;
	personality: string;
}

export const BOTS: CaseBattleBot[] = [
	{
		id: "bot-gaben",
		name: "Lord Gaben",
		title: "El Patriarca del Drop",
		avatar: "👑",
		personality:
			"Estos cuchillos toman tiempo, pero la paciencia siempre rinde.",
	},
	{
		id: "bot-clucky",
		name: "Clucky",
		title: "Pollo de Inferno",
		avatar: "🐔",
		personality: "¡Bawk bawk! Cruzo el humo de Banana sin miedo a las flash.",
	},
	{
		id: "bot-neo",
		name: "Neo-Sniper",
		title: "El Francotirador Silencioso",
		avatar: "🎯",
		personality: "Un tiro, una baja. El carrete nunca miente.",
	},
	{
		id: "bot-jarvis",
		name: "Jarvis AI",
		title: "Algoritmo Cuántico",
		avatar: "🤖",
		personality: "He calculado 14.000.605 probabilidades para este cofre.",
	},
	{
		id: "bot-boris",
		name: "Boris Rush-B",
		title: "Veterano de Mirage",
		avatar: "⚡",
		personality: "P90 sin frenar. Si dudas, perdiste la ronda.",
	},
];

export const TIER_FALLBACK_USD: Record<string, number> = {
	legendary: 80.0,
	epic: 15.0,
	rare: 2.0,
	common: 0.5,
};

export function getBattleItemValue(
	db: Db,
	name: string,
	rarity: string | null,
): number {
	const priceRow = db
		.prepare("SELECT usd FROM skin_prices WHERE name = ?")
		.get(name) as { usd: number | null } | undefined;

	if (
		priceRow &&
		typeof priceRow.usd === "number" &&
		Number.isFinite(priceRow.usd) &&
		priceRow.usd > 0
	) {
		return priceRow.usd;
	}

	const r = (rarity ?? "common").toLowerCase();
	return TIER_FALLBACK_USD[r] ?? 0.5;
}

export type BattleWinner = "player" | "bot" | "tie";

export interface BattleItemResult {
	id: string;
	name: string;
	rarity: string | null;
	image: string | null;
	rarityColor: string | null;
	valueUsd: number;
}

export interface CaseBattleResult {
	battleId: string;
	chestId: string;
	chestName: string;
	chestImage: string | null;
	bot: CaseBattleBot;
	playerItem: BattleItemResult;
	botItem: BattleItemResult;
	winner: BattleWinner;
	xpSpent: number;
	createdAt: string;
}

export interface ExecuteCaseBattleInput {
	chestId: string;
	botId?: string;
	operationId?: string;
	rand?: () => number;
	overridePlayerItem?: ChestItem;
	overrideBotItem?: ChestItem;
}

export interface CaseBattleRow {
	id: string;
	chest_id: string;
	chest_name: string;
	bot_id: string;
	bot_name: string;
	player_item_id: string;
	player_item_name: string;
	player_item_rarity: string | null;
	player_item_image: string | null;
	player_item_value: number;
	bot_item_id: string;
	bot_item_name: string;
	bot_item_rarity: string | null;
	bot_item_image: string | null;
	bot_item_value: number;
	winner: BattleWinner;
	xp_spent: number;
	created_at: string;
}

export function listCaseBattles(db: Db, limit = 20): CaseBattleRow[] {
	return db
		.prepare(
			"SELECT * FROM case_battles ORDER BY created_at DESC, rowid DESC LIMIT ?",
		)
		.all(limit) as CaseBattleRow[];
}

export function executeCaseBattle(
	db: Db,
	input: ExecuteCaseBattleInput,
): CaseBattleResult {
	if (input.operationId) {
		const existing = db
			.prepare("SELECT * FROM case_battles WHERE id = ?")
			.get(input.operationId) as CaseBattleRow | undefined;

		if (existing) {
			const bot = BOTS.find((b) => b.id === existing.bot_id) ?? {
				id: existing.bot_id,
				name: existing.bot_name,
				title: "Contrincante",
				avatar: "🤖",
				personality: "Desafiante en la arena.",
			};
			const chest = getRewardById(db, existing.chest_id);

			return {
				battleId: existing.id,
				chestId: existing.chest_id,
				chestName: existing.chest_name,
				chestImage: chest?.image ?? null,
				bot,
				playerItem: {
					id: existing.player_item_id,
					name: existing.player_item_name,
					rarity: existing.player_item_rarity,
					image: existing.player_item_image,
					rarityColor: null,
					valueUsd: existing.player_item_value,
				},
				botItem: {
					id: existing.bot_item_id,
					name: existing.bot_item_name,
					rarity: existing.bot_item_rarity,
					image: existing.bot_item_image,
					rarityColor: null,
					valueUsd: existing.bot_item_value,
				},
				winner: existing.winner,
				xpSpent: existing.xp_spent,
				createdAt: existing.created_at,
			};
		}
	}

	const chest = getRewardById(db, input.chestId);
	if (chest?.type !== "chest") {
		throw new Error("cofre no encontrado");
	}

	const pool = getChestPool(db, chest.id);
	if (pool.length === 0) {
		throw new Error("no hay objetos definidos para este cofre");
	}

	let selectedBot: CaseBattleBot;
	if (input.botId) {
		const found = BOTS.find((b) => b.id === input.botId);
		if (!found) {
			throw new Error(`bot desconocido: ${input.botId}`);
		}
		selectedBot = found;
	} else {
		const randBotIndex = Math.floor(
			(input.rand ? input.rand() : Math.random()) * BOTS.length,
		);
		selectedBot = BOTS[randBotIndex] ?? BOTS[0];
	}

	const keyCost = getSaleEconomy(db).keyCostXpUnits;
	const totalCost = chest.xp_cost + keyCost;

	const poolItems: ChestItem[] = pool.map((r) => ({
		id: r.id,
		name: r.name,
		rarity: r.rarity as "common" | "rare" | "epic" | "legendary",
	}));

	const battleId = input.operationId || randomUUID();
	const now = new Date().toISOString();

	let battleResult: CaseBattleResult | null = null;

	db.transaction(() => {
		const balance = getXpBalance(db);
		if (balance < totalCost) {
			throw new Error(
				`XP insuficiente: requieres ${formatXp(totalCost)} XP (tienes ${formatXp(balance)} XP)`,
			);
		}

		incrementXpBalance(db, -totalCost);

		// Pick items independently
		const playerPicked =
			input.overridePlayerItem ?? pickChestItem(poolItems, input.rand);
		const botPicked =
			input.overrideBotItem ?? pickChestItem(poolItems, input.rand);

		const playerRow = pool.find((r) => r.id === playerPicked.id) ?? pool[0];
		const botRow = pool.find((r) => r.id === botPicked.id) ?? pool[0];

		const playerValue = getBattleItemValue(
			db,
			playerRow.name,
			playerRow.rarity,
		);
		const botValue = getBattleItemValue(db, botRow.name, botRow.rarity);

		let winner: BattleWinner;
		if (playerValue > botValue) {
			winner = "player";
		} else if (botValue > playerValue) {
			winner = "bot";
		} else {
			winner = "tie";
		}

		// Ledger Impact in `redemptions`
		if (winner === "player") {
			// 1. Player's won skin (primary cost)
			db.prepare(
				`INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity, won_item_image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			).run(
				randomUUID(),
				chest.id,
				totalCost,
				now,
				`${chest.name} (Case Battle)`,
				playerRow.id,
				playerRow.name,
				playerRow.rarity,
				playerRow.image,
			);

			// 2. Bot's skin awarded to player as spoils (xp_spent = 0)
			db.prepare(
				`INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity, won_item_image)
         VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?)`,
			).run(
				randomUUID(),
				chest.id,
				now,
				`Bot Loot: ${selectedBot.name} (Case Battle)`,
				botRow.id,
				botRow.name,
				botRow.rarity,
				botRow.image,
			);
		} else if (winner === "bot") {
			// Player lost both skins: record financial expense, but won_item_id = NULL
			db.prepare(
				`INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity, won_item_image)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
			).run(
				randomUUID(),
				chest.id,
				totalCost,
				now,
				`${chest.name} (Case Battle - Derrota vs ${selectedBot.name})`,
			);
		} else {
			// Tie: player retains their own rolled item
			db.prepare(
				`INSERT INTO redemptions (id, reward_id, xp_spent, redeemed_at, reward_name_snapshot, won_item_id, won_item_name, won_item_rarity, won_item_image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			).run(
				randomUUID(),
				chest.id,
				totalCost,
				now,
				`${chest.name} (Case Battle - Empate)`,
				playerRow.id,
				playerRow.name,
				playerRow.rarity,
				playerRow.image,
			);
		}

		// Record battle history in `case_battles`
		db.prepare(
			`INSERT INTO case_battles (
        id, chest_id, chest_name, bot_id, bot_name,
        player_item_id, player_item_name, player_item_rarity, player_item_image, player_item_value,
        bot_item_id, bot_item_name, bot_item_rarity, bot_item_image, bot_item_value,
        winner, xp_spent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			battleId,
			chest.id,
			chest.name,
			selectedBot.id,
			selectedBot.name,
			playerRow.id,
			playerRow.name,
			playerRow.rarity,
			playerRow.image,
			playerValue,
			botRow.id,
			botRow.name,
			botRow.rarity,
			botRow.image,
			botValue,
			winner,
			totalCost,
			now,
		);

		battleResult = {
			battleId,
			chestId: chest.id,
			chestName: chest.name,
			chestImage: chest.image ?? null,
			bot: selectedBot,
			playerItem: {
				id: playerRow.id,
				name: playerRow.name,
				rarity: playerRow.rarity,
				image: playerRow.image,
				rarityColor: playerRow.rarity_color,
				valueUsd: playerValue,
			},
			botItem: {
				id: botRow.id,
				name: botRow.name,
				rarity: botRow.rarity,
				image: botRow.image,
				rarityColor: botRow.rarity_color,
				valueUsd: botValue,
			},
			winner,
			xpSpent: totalCost,
			createdAt: now,
		};
	})();

	if (!battleResult) {
		throw new Error("fallo en la transaccion de batalla");
	}

	return battleResult;
}
