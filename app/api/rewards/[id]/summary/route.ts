import { NextResponse } from 'next/server';
import { summarizeChestPrices } from '@/lib/chest-grid';
import { getDb } from '@/lib/db';
import { getChestPool, getRewardById } from '@/lib/rewards-store';
import { effectiveKeyCostUnits, getSaleEconomy } from '@/lib/settings-store';
import { getSkinPrices, resolvePriceWithFallback } from '@/lib/skin-prices';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (typeof params.id !== 'string' || params.id.trim().length === 0) {
    return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  }
  const db = getDb();
  const chest = getRewardById(db, params.id);
  if (chest?.type !== 'chest') {
    return NextResponse.json({ error: 'cofre no encontrado' }, { status: 404 });
  }

  const pool = getChestPool(db, chest.id);
  const prices = getSkinPrices(
    db,
    pool.map((r) => r.name)
  );
  const items = pool.map((r) => {
    const { usd, isFallback } = resolvePriceWithFallback(prices.get(r.name), r.rarity, r.name);
    return { name: r.name, rarity: r.rarity, usd, isFallback };
  });
  const openCostUnits =
    chest.xp_cost + effectiveKeyCostUnits(chest, getSaleEconomy(db).keyCostXpUnits);

  return NextResponse.json({ ...summarizeChestPrices(items, openCostUnits), openCostUnits });
}
