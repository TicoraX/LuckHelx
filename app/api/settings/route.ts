import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getDeepseekKey, setDeepseekKey, getOpeningSound, setOpeningSound, getSaleEconomy, setSaleEconomy } from '@/lib/settings-store';
import { hasCustomOpeningSound } from '@/lib/user-sounds';

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    hasDeepseekKey: getDeepseekKey(db) !== null,
    openingSound: { ...getOpeningSound(db), custom: hasCustomOpeningSound() },
    saleEconomy: getSaleEconomy(db),
  });
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

  const { deepseekKey, openingSound, saleEconomy } = body as Record<string, unknown>;

  if (saleEconomy !== undefined) {
    if (saleEconomy === null || typeof saleEconomy !== 'object' || Array.isArray(saleEconomy)) {
      return NextResponse.json({ error: 'economia invalida' }, { status: 400 });
    }
    const { sellRate, keyCostXp } = saleEconomy as Record<string, unknown>;
    try {
      setSaleEconomy(getDb(), { sellRate: Number(sellRate), keyCostXp: Number(keyCostXp) });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    if (deepseekKey === undefined && openingSound === undefined) {
      return NextResponse.json({ ok: true });
    }
  }

  // Los dos ajustes se guardan por separado: mandar el sonido no obliga a reenviar la
  // clave de API, que el GET nunca devuelve y el cliente por lo tanto no tiene.
  if (openingSound !== undefined) {
    if (openingSound === null || typeof openingSound !== 'object' || Array.isArray(openingSound)) {
      return NextResponse.json({ error: 'sonido invalido' }, { status: 400 });
    }
    const { offsetSeconds, spinDurationMs } = openingSound as Record<string, unknown>;
    try {
      setOpeningSound(getDb(), {
        offsetSeconds: Number(offsetSeconds),
        spinDurationMs: Number(spinDurationMs),
      });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    if (deepseekKey === undefined) return NextResponse.json({ ok: true });
  }

  if (typeof deepseekKey !== 'string' || deepseekKey.trim().length === 0) {
    return NextResponse.json({ error: 'clave invalida' }, { status: 400 });
  }

  setDeepseekKey(getDb(), deepseekKey.trim());
  return NextResponse.json({ ok: true });
}
