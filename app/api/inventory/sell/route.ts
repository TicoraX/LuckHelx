import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listInventory, sellOneItem } from '@/lib/rewards-store';
import { getSaleEconomy } from '@/lib/settings-store';
import { getSkinPrices, resolvePriceWithFallback } from '@/lib/skin-prices';
import { XP_SCALE } from '@/lib/xp';

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

  const { itemId } = body as { itemId: unknown };
  if (typeof itemId !== 'string' || itemId.length === 0) {
    return NextResponse.json({ error: 'itemId invalido' }, { status: 400 });
  }

  const db = getDb();
  const owned = listInventory(db).find((row) => row.id === itemId);
  if (!owned) return NextResponse.json({ error: 'no tenes ese objeto' }, { status: 400 });

  const cached = getSkinPrices(db, [owned.name]).get(owned.name);
  const resolved = resolvePriceWithFallback(cached, owned.rarity, owned.name);

  // El XP que se paga sale del precio de mercado (o fallback garantizado de tier) con el
  // recorte configurado. Una unidad es un centavo, así que el precio entra entero.
  // El piso queda en una unidad, para que nada desaparezca a cambio de cero.
  const { sellRate } = getSaleEconomy(db);
  const xpUnits = Math.max(1, Math.round(resolved.usd * XP_SCALE * sellRate));

  const sale = sellOneItem(db, itemId, xpUnits, resolved.usd);
  if (!sale) return NextResponse.json({ error: 'no tenes ese objeto' }, { status: 400 });

  return NextResponse.json({
    sold: sale,
    xpCredited: xpUnits,
    unitUsd: resolved.usd,
    isFallback: resolved.isFallback,
  });
}
