import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRewardById, updateReward, deleteReward } from '@/lib/rewards-store';
import { RARITIES, Rarity } from '@/lib/rewards';

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
  // En unidades de XP, igual que al crear. Ver app/api/rewards/route.ts.
  const { name, xpCostUnits, rarity } = body as { name: string; xpCostUnits: number; rarity: 'common' | 'rare' | 'epic' | 'legendary' | null };

  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'nombre invalido' }, { status: 400 });
  }
  const cost = Number(xpCostUnits);
  if (!Number.isFinite(cost) || !Number.isInteger(cost) || cost <= 0) {
    return NextResponse.json({ error: 'costo invalido' }, { status: 400 });
  }

  const db = getDb();
  const existing = getRewardById(db, params.id);
  if (!existing) return NextResponse.json({ error: 'recompensa no encontrada' }, { status: 404 });

  if (existing.type === 'chest_item' && !RARITIES.includes(rarity as Rarity)) {
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
