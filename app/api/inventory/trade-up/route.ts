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

  const { inputRarity, itemIds } = body as { inputRarity: unknown; itemIds: unknown };

  if (typeof inputRarity !== 'string' || !VALID_TRADE_UP_RARITIES.includes(inputRarity as any)) {
    return NextResponse.json({ error: 'rareza de entrada invalida' }, { status: 400 });
  }

  if (!Array.isArray(itemIds) || itemIds.length !== 10 || !itemIds.every((id) => typeof id === 'string' && id)) {
    return NextResponse.json({ error: 'debes seleccionar exactamente 10 skins validas' }, { status: 400 });
  }

  const db = getDb();

  try {
    const result = executeTradeUp(db, {
      inputRarity: inputRarity as TradeUpInputRarity,
      itemIds,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'error al ejecutar el contrato de intercambio' }, { status: 400 });
  }
}
