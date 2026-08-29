import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getChestCollections } from '@/lib/collections';

export async function GET() {
  const db = getDb();
  const collections = getChestCollections(db);
  return NextResponse.json({ collections });
}
