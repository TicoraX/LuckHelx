import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listInventory } from '@/lib/rewards-store';
import { getSkinPrices, isPriceable, isStale } from '@/lib/skin-prices';

import { calculateDropStats } from '@/lib/drop-stats';

// Solo lectura: el inventario se deriva de los canjes, no se guarda aparte. Los precios
// son de referencia y salen del cache; refrescarlos es una accion aparte y explicita,
// porque implica pegarle a Steam.
export async function GET() {
  const db = getDb();
  const rows = listInventory(db);
  const prices = getSkinPrices(db, rows.map((row) => row.name));

  const items = rows.map((row) => {
    const price = prices.get(row.name);
    return {
      ...row,
      priceUsd: price?.usd ?? null,
      priceWear: price?.wear ?? null,
      priceStale: isPriceable(row.name) ? isStale(price) : false,
    };
  });

  const valued = items.filter((item) => item.priceUsd !== null);

  const redemptions = db
    .prepare('SELECT won_item_rarity, xp_spent FROM redemptions WHERE won_item_id IS NOT NULL')
    .all() as { won_item_rarity: string | null; xp_spent: number }[];
  const dropStats = calculateDropStats(redemptions);

  return NextResponse.json({
    items,
    totalItems: items.reduce((sum, item) => sum + item.count, 0),
    uniqueItems: items.length,
    // Solo suma lo que tiene precio: mezclar los sin cotizar como cero daria un total
    // que parece completo y no lo es.
    totalUsd: valued.reduce((sum, item) => sum + (item.priceUsd ?? 0) * item.count, 0),
    valuedItems: valued.length,
    pendingPrices: items.filter((item) => item.priceStale).length,
    dropStats,
  });
}
