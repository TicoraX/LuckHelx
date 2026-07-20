// app/api/rewards/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getXpBalance } from '@/lib/settings-store';
import { listRewards, insertReward } from '@/lib/rewards-store';

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    xpBalance: getXpBalance(db),
    rewards: listRewards(db),
  });
}

export async function POST(request: Request) {
  const { type, name, xpCost, rarity } = await request.json();

  if (!['shop', 'chest', 'chest_item'].includes(type)) {
    return NextResponse.json({ error: 'tipo invalido' }, { status: 400 });
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'nombre invalido' }, { status: 400 });
  }
  const cost = Number(xpCost);
  if (!Number.isFinite(cost) || cost <= 0) {
    return NextResponse.json({ error: 'costo invalido' }, { status: 400 });
  }

  const db = getDb();
  const reward = insertReward(db, {
    type,
    name: name.trim(),
    xpCost: cost,
    rarity: type === 'chest_item' ? rarity : null,
  });

  return NextResponse.json({ reward });
}
