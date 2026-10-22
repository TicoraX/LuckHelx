import { NextResponse } from 'next/server';
import { getChestCollections } from '@/lib/collections';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const collections = getChestCollections(db);
  return NextResponse.json({ collections });
}
