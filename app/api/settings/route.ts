import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getDeepseekKey, setDeepseekKey } from '@/lib/settings-store';

export async function GET() {
  const db = getDb();
  return NextResponse.json({ hasDeepseekKey: getDeepseekKey(db) !== null });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'cuerpo de solicitud invalido' },
      { status: 400 }
    );
  }

  // Ensure body is a plain object (not null, not an array)
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'cuerpo de solicitud invalido' },
      { status: 400 }
    );
  }

  const { deepseekKey } = body as Record<string, unknown>;
  if (typeof deepseekKey !== 'string' || deepseekKey.trim().length === 0) {
    return NextResponse.json({ error: 'clave invalida' }, { status: 400 });
  }

  setDeepseekKey(getDb(), deepseekKey.trim());
  return NextResponse.json({ ok: true });
}
