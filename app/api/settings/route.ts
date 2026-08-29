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
  const db = getDb();

  // Cada ajuste es opcional: mandar el sonido no obliga a reenviar la clave de API, que el
  // GET nunca devuelve y el cliente por lo tanto no tiene.
  //
  // Se arma la lista de escrituras primero y se corren todas juntas al final. Antes se
  // escribía a medida que se validaba, así que un cuerpo con la economía buena y el sonido
  // malo devolvía 400 dejando la economía ya guardada: un 400 tiene que significar que
  // nada cambió.
  const writes: (() => void)[] = [];

  if (saleEconomy !== undefined) {
    if (saleEconomy === null || typeof saleEconomy !== 'object' || Array.isArray(saleEconomy)) {
      return NextResponse.json({ error: 'economia invalida' }, { status: 400 });
    }
    // El campo se llama `keyCostXpUnits` y no `keyCostXp` a propósito: un cliente viejo
    // que mande XP entero manda un campo que ya no existe y se lleva un 400, en vez de
    // configurar una llave cien veces más barata sin que nadie se entere.
    const { sellRate, keyCostXpUnits } = saleEconomy as Record<string, unknown>;
    writes.push(() => setSaleEconomy(db, { sellRate: Number(sellRate), keyCostXpUnits: Number(keyCostXpUnits) }));
  }

  if (openingSound !== undefined) {
    if (openingSound === null || typeof openingSound !== 'object' || Array.isArray(openingSound)) {
      return NextResponse.json({ error: 'sonido invalido' }, { status: 400 });
    }
    const { offsetSeconds, spinDurationMs } = openingSound as Record<string, unknown>;
    writes.push(() =>
      setOpeningSound(db, { offsetSeconds: Number(offsetSeconds), spinDurationMs: Number(spinDurationMs) })
    );
  }

  if (deepseekKey !== undefined) {
    if (typeof deepseekKey !== 'string' || deepseekKey.trim().length === 0) {
      return NextResponse.json({ error: 'clave invalida' }, { status: 400 });
    }
    writes.push(() => setDeepseekKey(db, deepseekKey.trim()));
  }

  if (writes.length === 0) {
    return NextResponse.json({ error: 'no hay nada que guardar' }, { status: 400 });
  }

  try {
    // Los setters validan adentro y tiran; la transacción revierte lo que ya se escribió.
    db.transaction(() => writes.forEach((write) => write()))();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
