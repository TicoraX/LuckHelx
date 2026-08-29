import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { executeBatchOpen } from '@/lib/batch-open';

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

  const { chestId, count, operationId, idempotencyKey } = body as {
    chestId: unknown;
    count: unknown;
    operationId?: unknown;
    idempotencyKey?: unknown;
  };
  if (typeof chestId !== 'string' || !chestId) {
    return NextResponse.json({ error: 'chestId invalido' }, { status: 400 });
  }

  const numCount = Number(count);
  if (!Number.isInteger(numCount) || numCount < 1 || numCount > 10) {
    return NextResponse.json({ error: 'cantidad de apertura invalida (1 a 10)' }, { status: 400 });
  }

  const rawOpId = operationId || idempotencyKey;
  const safeOpId = typeof rawOpId === 'string' && rawOpId.trim().length > 0 ? rawOpId.trim() : undefined;

  const db = getDb();

  try {
    const result = executeBatchOpen(db, { chestId, count: numCount, operationId: safeOpId });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'error al abrir cofres en lote' }, { status: 400 });
  }
}
