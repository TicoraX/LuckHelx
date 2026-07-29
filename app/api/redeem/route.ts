import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRewardById, redeemIfSufficient, getChestPool } from '@/lib/rewards-store';
import { pickChestItem } from '@/lib/rewards';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'rewardId invalido' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'rewardId invalido' }, { status: 400 });
  }

  const { rewardId } = body as { rewardId: unknown };
  if (typeof rewardId !== 'string' || rewardId.length === 0) {
    return NextResponse.json({ error: 'rewardId invalido' }, { status: 400 });
  }

  const db = getDb();
  const reward = getRewardById(db, rewardId);
  if (!reward) return NextResponse.json({ error: 'recompensa no encontrada' }, { status: 404 });

  let redeemedItem: { id?: string; name: string; rarity?: string; image?: string | null; rarity_color?: string | null } = { name: reward.name };

  if (reward.type === 'chest') {
    const chestItems = getChestPool(db, reward.id);
    if (chestItems.length === 0) {
      return NextResponse.json({ error: 'no hay objetos definidos para este cofre' }, { status: 400 });
    }
    const picked = pickChestItem(
      chestItems.map((r) => ({ id: r.id, name: r.name, rarity: r.rarity as 'common' | 'rare' | 'epic' | 'legendary' }))
    );
    const pickedRow = chestItems.find((r) => r.id === picked.id)!;
    redeemedItem = { id: picked.id, name: picked.name, rarity: picked.rarity, image: pickedRow.image, rarity_color: pickedRow.rarity_color };
  } else if (reward.type === 'chest_item') {
    return NextResponse.json({ error: 'no se puede canjear un objeto de cofre' }, { status: 400 });
  }

  const redeemed = redeemIfSufficient(db, rewardId);
  if (!redeemed) return NextResponse.json({ error: 'xp insuficiente' }, { status: 400 });

  return NextResponse.json({ redeemed: redeemedItem });
}
