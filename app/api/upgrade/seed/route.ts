import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { rotateProvablyFairSeed } from '@/lib/upgrade';

export async function POST() {
  try {
    return NextResponse.json(rotateProvablyFairSeed(getDb()));
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Error al rotar la semilla' },
      { status: 500 }
    );
  }
}
