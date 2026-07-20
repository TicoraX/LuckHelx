import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listRewards, redeemIfSufficient } from '@/lib/rewards-store';
import { pickChestItem } from '@/lib/rewards';

export async function POST(request: Request) {
  const { rewardId } = await request.json();
  if (typeof rewardId !== 'string' || rewardId.length === 0) {
    return NextResponse.json({ error: 'rewardId invalido' }, { status: 400 });
  }

  const db = getDb();
  const reward = listRewards(db).find((r) => r.id === rewardId);
  if (!reward) return NextResponse.json({ error: 'recompensa no encontrada' }, { status: 404 });

  let redeemedItem: { id?: string; name: string; rarity?: string } = { name: reward.name };

  if (reward.type === 'chest') {
    const chestItems = listRewards(db).filter((r) => r.type === 'chest_item');
    if (chestItems.length === 0) {
      return NextResponse.json({ error: 'no hay objetos definidos para este cofre' }, { status: 400 });
    }
    const picked = pickChestItem(
      chestItems.map((r) => ({ id: r.id, name: r.name, rarity: r.rarity as 'common' | 'rare' | 'epic' }))
    );
    redeemedItem = { id: picked.id, name: picked.name, rarity: picked.rarity };
  }

  const redeemed = redeemIfSufficient(db, rewardId);
  if (!redeemed) return NextResponse.json({ error: 'xp insuficiente' }, { status: 400 });

  return NextResponse.json({ redeemed: redeemedItem });
}
