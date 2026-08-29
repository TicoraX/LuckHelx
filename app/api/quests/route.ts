import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listQuestsWithProgress } from '@/lib/quests';

export async function GET() {
  const db = getDb();
  const quests = listQuestsWithProgress(db);
  return NextResponse.json({ quests });
}
