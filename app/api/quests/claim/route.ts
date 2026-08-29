import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { claimQuest } from '@/lib/quests';

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

  const { questId } = body as { questId: unknown };
  if (typeof questId !== 'string' || !questId) {
    return NextResponse.json({ error: 'questId invalido' }, { status: 400 });
  }

  const db = getDb();

  try {
    const result = claimQuest(db, questId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'error al reclamar mision' }, { status: 400 });
  }
}
