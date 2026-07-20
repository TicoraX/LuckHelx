import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { completeTask } from '@/lib/tasks-store';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'taskId invalido' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'taskId invalido' }, { status: 400 });
  }

  const { taskId } = body as { taskId: unknown };
  if (typeof taskId !== 'string' || taskId.length === 0) {
    return NextResponse.json({ error: 'taskId invalido' }, { status: 400 });
  }

  const db = getDb();
  try {
    const task = completeTask(db, taskId);
    return NextResponse.json({ ok: true, xpAwarded: task.xp_value ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error desconocido';
    const status = message.includes('no encontrada') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
