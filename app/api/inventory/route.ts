import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listInventory } from '@/lib/rewards-store';

// Solo lectura: el inventario se deriva de los canjes, no se guarda aparte.
export async function GET() {
  const db = getDb();
  const items = listInventory(db);

  return NextResponse.json({
    items,
    totalItems: items.reduce((sum, item) => sum + item.count, 0),
    uniqueItems: items.length,
  });
}
