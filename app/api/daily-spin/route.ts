import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getDailySpinStatus, executeDailySpin } from '@/lib/daily-spin';

export async function GET() {
  const db = getDb();
  const status = getDailySpinStatus(db);
  return NextResponse.json({ status });
}

export async function POST() {
  const db = getDb();
  try {
    const result = executeDailySpin(db);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'error al realizar giro diario' }, { status: 400 });
  }
}
