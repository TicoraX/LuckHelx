import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPrestigeStatus, claimPrestige } from '@/lib/prestige';

export async function GET() {
  const db = getDb();
  const status = getPrestigeStatus(db);
  return NextResponse.json({ status });
}

export async function POST() {
  const db = getDb();
  try {
    const result = claimPrestige(db);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error al reclamar prestigio';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
