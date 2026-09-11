import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST() {
  try {
    const db = getDb();
    // Run SQLite PRAGMA optimize and VACUUM to reclaim free pages and defragment
    db.exec('PRAGMA optimize;');
    db.exec('VACUUM;');

    return NextResponse.json({
      ok: true,
      message: 'Base de datos optimizada y compactada correctamente.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al optimizar la base de datos';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
