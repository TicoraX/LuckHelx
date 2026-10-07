import { NextResponse } from "next/server";
import { BOTS, executeCaseBattle, listCaseBattles } from "@/lib/case-battle";
import { getDb } from "@/lib/db";

export async function GET() {
	const db = getDb();
	const history = listCaseBattles(db, 20);
	return NextResponse.json({ bots: BOTS, history });
}

export async function POST(request: Request) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "cuerpo de solicitud invalido" },
			{ status: 400 },
		);
	}

	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		return NextResponse.json(
			{ error: "cuerpo de solicitud invalido" },
			{ status: 400 },
		);
	}

	const { chestId, botId, operationId, idempotencyKey } = body as {
		chestId?: unknown;
		botId?: unknown;
		operationId?: unknown;
		idempotencyKey?: unknown;
	};

	if (typeof chestId !== "string" || !chestId.trim()) {
		return NextResponse.json({ error: "chestId invalido" }, { status: 400 });
	}

	const safeBotId =
		typeof botId === "string" && botId.trim().length > 0
			? botId.trim()
			: undefined;
	const rawOpId = operationId || idempotencyKey;
	const safeOpId =
		typeof rawOpId === "string" && rawOpId.trim().length > 0
			? rawOpId.trim()
			: undefined;

	const db = getDb();

	try {
		const result = executeCaseBattle(db, {
			chestId: chestId.trim(),
			botId: safeBotId,
			operationId: safeOpId,
		});
		return NextResponse.json(result);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "error al ejecutar batalla de cajas";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
