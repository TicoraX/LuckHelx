import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { exportBackup, isValidBackup, restoreBackup } from '@/lib/backup';

export async function GET() {
  const db = getDb();
  const backup = exportBackup(db);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="recompensas-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'archivo invalido' }, { status: 400 });
  }

  if (!isValidBackup(body)) {
    return NextResponse.json({ error: 'el archivo no tiene el formato de un respaldo valido' }, { status: 400 });
  }

  restoreBackup(getDb(), body);
  return NextResponse.json({ ok: true });
}
