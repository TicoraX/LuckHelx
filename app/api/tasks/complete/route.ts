import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { completeTask } from '@/lib/tasks-store';

export async function POST(request: Request) {
  const { taskId } = await request.json();
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
