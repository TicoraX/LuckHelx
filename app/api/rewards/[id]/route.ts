import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRewardById, updateReward, deleteReward } from '@/lib/rewards-store';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'cuerpo de solicitud invalido' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'cuerpo de solicitud invalido' }, { status: 400 });
  }
  const { name, xpCost, rarity } = body as { name: string; xpCost: number; rarity: 'common' | 'rare' | 'epic' | 'legendary' | null };

  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'nombre invalido' }, { status: 400 });
  }
  const cost = Number(xpCost);
  if (!Number.isFinite(cost) || cost <= 0) {
    return NextResponse.json({ error: 'costo invalido' }, { status: 400 });
  }

  const db = getDb();
  const existing = getRewardById(db, params.id);
  if (!existing) return NextResponse.json({ error: 'recompensa no encontrada' }, { status: 404 });

  const validRarities = ['common', 'rare', 'epic', 'legendary'];
  if (existing.type === 'chest_item' && !validRarities.includes(rarity as string)) {
    return NextResponse.json({ error: 'rareza invalida' }, { status: 400 });
  }

  const reward = updateReward(db, params.id, {
    name: name.trim(),
    xpCost: cost,
    rarity: existing.type === 'chest_item' ? rarity : null,
  });
  return NextResponse.json({ reward });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  try {
    deleteReward(db, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error desconocido';
    const status = message.includes('no encontrada') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
