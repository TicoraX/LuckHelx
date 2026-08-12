import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getXpBalance } from '@/lib/settings-store';
import { listTasks } from '@/lib/tasks-store';
import { listRedemptions } from '@/lib/rewards-store';

// A single chronological feed of every XP-affecting event — credited tasks (+xp)
// and redemptions (-xp) — merged and sorted, like a real ledger statement.
// Read-only: this endpoint never mutates state, it just re-presents what the
// tasks/rewards stores already recorded.
export async function GET() {
  const db = getDb();

  const credits = listTasks(db)
    .filter((t) => t.status === 'credited' && t.completed_at)
    .map((t) => ({
      id: t.id,
      kind: 'credit' as const,
      label: t.title,
      xp: t.xp_value ?? 0,
      at: t.completed_at as string,
      wonItem: null,
    }));

  const debits = listRedemptions(db).map((r) => ({
    id: r.id,
    kind: 'debit' as const,
    label: r.reward_name,
    xp: -r.xp_spent,
    at: r.redeemed_at,
    // Null en los canjes de tienda y en los cofres anteriores a la migración, que
    // se abrieron cuando el premio no se guardaba en ningún lado.
    wonItem: r.won_item_name
      ? { name: r.won_item_name, rarity: r.won_item_rarity, image: r.won_item_image }
      : null,
  }));

  const entries = [...credits, ...debits].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return NextResponse.json({ xpBalance: getXpBalance(db), entries });
}
