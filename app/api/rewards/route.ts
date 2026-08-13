// app/api/rewards/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getXpBalance } from '@/lib/settings-store';
import { listRewards, insertReward, listChestContents } from '@/lib/rewards-store';
import { RARITIES, Rarity } from '@/lib/rewards';

export async function GET() {
  const db = getDb();
  const rewards = listRewards(db);
  const chestContents = listChestContents(db);

  // Se calcula acá para que el cliente no tenga que recorrer los ~16k links en cada render.
  const legendaryItemIds = new Set(rewards.filter((r) => r.rarity === 'legendary').map((r) => r.id));
  const chestsWithRareDrop = new Set(
    chestContents.filter((link) => legendaryItemIds.has(link.chestItemId)).map((link) => link.chestId)
  );

  return NextResponse.json({
    xpBalance: getXpBalance(db),
    rewards: rewards.map((r) => (r.type === 'chest' ? { ...r, hasRareDrop: chestsWithRareDrop.has(r.id) } : r)),
    chestContents,
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
  if (type === 'chest_item' && !RARITIES.includes(rarity as Rarity)) {
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
