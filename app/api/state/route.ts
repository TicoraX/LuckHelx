import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getXpBalance } from '@/lib/settings-store';
import { listTasks, resetRecurringTasks } from '@/lib/tasks-store';
import { countRedemptions } from '@/lib/rewards-store';

export async function GET() {
  const db = getDb();
  resetRecurringTasks(db);
  return NextResponse.json({
    xpBalance: getXpBalance(db),
    tasks: listTasks(db),
    redemptionCount: countRedemptions(db),
  });
}
