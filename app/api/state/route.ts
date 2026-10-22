import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { syncPremierRating } from '@/lib/ranks';
import { countRedemptions } from '@/lib/rewards-store';
import { getXpBalance } from '@/lib/settings-store';
import { listTasks, resetRecurringTasks } from '@/lib/tasks-store';

export async function GET() {
  const db = getDb();
  resetRecurringTasks(db);
  const premierRating = syncPremierRating(db);
  return NextResponse.json({
    xpBalance: getXpBalance(db),
    tasks: listTasks(db),
    redemptionCount: countRedemptions(db),
    premierRating,
  });
}
