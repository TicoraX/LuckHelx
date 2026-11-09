import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  calculateTradeUpProbabilities,
  executeTradeUp,
  type TradeUpInputRarity,
  VALID_TRADE_UP_RARITIES,
} from '@/lib/trade-up';
import type { Cs2GradeId } from '@/lib/cs2-grade';

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

  const { inputGrade, inputRarity, itemIds, operationId, preview } = body as {
    inputGrade?: unknown;
    inputRarity?: unknown;
    itemIds: unknown;
    operationId?: unknown;
    preview?: unknown;
  };

  if (
    !Array.isArray(itemIds) ||
    itemIds.length !== 10 ||
    !itemIds.every((id) => typeof id === 'string' && id)
  ) {
    return NextResponse.json(
      { error: 'debes seleccionar exactamente 10 skins validas' },
      { status: 400 }
    );
  }

  const db = getDb();

  // Si se solicita previsualización de probabilidades sin ejecutar el contrato
  if (preview === true) {
    try {
      const previewResult = calculateTradeUpProbabilities(db, itemIds);
      return NextResponse.json(previewResult);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'error al calcular probabilidades de trade-up';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (
    inputRarity !== undefined &&
    (typeof inputRarity !== 'string' || !VALID_TRADE_UP_RARITIES.includes(inputRarity as any))
  ) {
    return NextResponse.json({ error: 'rareza de entrada invalida' }, { status: 400 });
  }

  const safeOpId =
    typeof operationId === 'string' && operationId.trim().length > 0
      ? operationId.trim()
      : undefined;

  try {
    const result = executeTradeUp(db, {
      inputGrade: typeof inputGrade === 'string' ? (inputGrade as Cs2GradeId) : undefined,
      inputRarity: typeof inputRarity === 'string' ? (inputRarity as TradeUpInputRarity) : undefined,
      itemIds,
      operationId: safeOpId,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'error al ejecutar el contrato de intercambio';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
