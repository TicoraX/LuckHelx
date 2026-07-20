import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { deleteTask } from '@/lib/tasks-store';

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  try {
    deleteTask(db, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error desconocido';
    const status = message.includes('no encontrada') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
