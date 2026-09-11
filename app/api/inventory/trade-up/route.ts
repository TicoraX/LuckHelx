import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { executeTradeUp, type TradeUpInputRarity, VALID_TRADE_UP_RARITIES } from '@/lib/trade-up';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'cuerpo de solicitud invalido' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'cuerpo de solicitud invalido' }, { status: 400 });
  }

  const { inputRarity, itemIds, operationId } = body as {
    inputRarity: unknown;
    itemIds: unknown;
    operationId?: unknown;
  };

  if (typeof inputRarity !== 'string' || !VALID_TRADE_UP_RARITIES.includes(inputRarity as any)) {
    return NextResponse.json({ error: 'rareza de entrada invalida' }, { status: 400 });
  }

  if (!Array.isArray(itemIds) || itemIds.length !== 10 || !itemIds.every((id) => typeof id === 'string' && id)) {
    return NextResponse.json({ error: 'debes seleccionar exactamente 10 skins validas' }, { status: 400 });
  }

  const safeOpId = typeof operationId === 'string' && operationId.trim().length > 0 ? operationId.trim() : undefined;

  const db = getDb();

  try {
    const result = executeTradeUp(db, {
      inputRarity: inputRarity as TradeUpInputRarity,
      itemIds,
      operationId: safeOpId,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error al ejecutar el contrato de intercambio';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
