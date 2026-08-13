import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listInventory, sellOneItem } from '@/lib/rewards-store';
import { getSaleEconomy } from '@/lib/settings-store';
import { getSkinPrices } from '@/lib/skin-prices';
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

  const price = getSkinPrices(db, [owned.name]).get(owned.name);
  if (!price || price.usd === null) {
    return NextResponse.json(
      { error: 'ese objeto no tiene precio todavia, actualizalos primero' },
      { status: 400 }
    );
  }

  // El XP que se paga sale del precio de mercado con el recorte configurado. Una unidad es
  // un centavo, así que el precio entra entero: antes esto redondeaba a XP y el piso de 1
  // XP pagaba de más por cualquier skin barata, que era justo la mitad de la impresora.
  // El piso queda en una unidad, para que nada desaparezca a cambio de cero.
  const { sellRate } = getSaleEconomy(db);
  const xpUnits = Math.max(1, Math.round(price.usd * XP_SCALE * sellRate));

  const sale = sellOneItem(db, itemId, xpUnits, price.usd);
  if (!sale) return NextResponse.json({ error: 'no tenes ese objeto' }, { status: 400 });

  return NextResponse.json({ sold: sale, xpCredited: xpUnits });
}
