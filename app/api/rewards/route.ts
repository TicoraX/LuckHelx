// app/api/rewards/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getXpBalance } from '@/lib/settings-store';
import { listRewards, insertReward, listChestContents } from '@/lib/rewards-store';

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    xpBalance: getXpBalance(db),
    rewards: listRewards(db),
    chestContents: listChestContents(db),
  });
}

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
  const { type, name, xpCost, rarity } = body as {
    type: 'shop' | 'chest' | 'chest_item';
    name: string;
    xpCost: number;
    rarity: 'common' | 'rare' | 'epic' | 'legendary' | null;
  };

  if (!['shop', 'chest', 'chest_item'].includes(type)) {
    return NextResponse.json({ error: 'tipo invalido' }, { status: 400 });
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'nombre invalido' }, { status: 400 });
  }
  const cost = Number(xpCost);
  if (!Number.isFinite(cost) || !Number.isInteger(cost) || cost <= 0) {
    return NextResponse.json({ error: 'costo invalido' }, { status: 400 });
  }
  const validRarities = ['common', 'rare', 'epic', 'legendary'];
  if (type === 'chest_item' && !validRarities.includes(rarity as string)) {
    return NextResponse.json({ error: 'rareza invalida' }, { status: 400 });
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
