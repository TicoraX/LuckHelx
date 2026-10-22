import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  executeUpgrade,
  getActiveProvablyFairSeed,
  listUpgrades,
  listUpgradeTargets,
  type SectorMode,
} from '@/lib/upgrade';

export async function GET() {
  try {
    const db = getDb();
    const history = listUpgrades(db, 30);
    const targets = listUpgradeTargets(db, 60);
    const activeSeed = getActiveProvablyFairSeed(db);

    return NextResponse.json({
      history,
      targets,
      activeSeed: {
        serverSeedHash: activeSeed.serverSeedHash,
        clientSeed: activeSeed.clientSeed,
        currentNonce: activeSeed.currentNonce,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Error al obtener estado de Upgrade' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud JSON inválido' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Cuerpo de solicitud JSON inválido' }, { status: 400 });
  }

  const { inputItemIds, xpSpentCents, targetItemId, sectorMode, clientSeed } = body as {
    inputItemIds?: unknown;
    xpSpentCents?: unknown;
    targetItemId?: unknown;
    sectorMode?: unknown;
    clientSeed?: unknown;
  };

  if (typeof targetItemId !== 'string' || !targetItemId.trim()) {
    return NextResponse.json({ error: 'targetItemId es requerido' }, { status: 400 });
  }

  let safeInputItemIds: string[] | undefined;
  if (Array.isArray(inputItemIds)) {
    safeInputItemIds = inputItemIds.filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0
    );
  }

  let safeXpSpentCents: number | undefined;
  if (typeof xpSpentCents === 'number' && Number.isInteger(xpSpentCents) && xpSpentCents > 0) {
    safeXpSpentCents = xpSpentCents;
  }

  if (
    (!safeInputItemIds || safeInputItemIds.length === 0) &&
    (!safeXpSpentCents || safeXpSpentCents <= 0)
  ) {
    return NextResponse.json(
      {
        error:
          'Debes proporcionar al menos una skin de inventario o un monto en centésimas de XP como entrada.',
      },
      { status: 400 }
    );
  }

  const safeSectorMode: SectorMode = sectorMode === 'over' ? 'over' : 'under';
  const safeClientSeed =
    typeof clientSeed === 'string' && clientSeed.trim().length > 0
      ? clientSeed.trim().slice(0, 128)
      : undefined;

  try {
    const db = getDb();
    const result = executeUpgrade(db, {
      inputItemIds: safeInputItemIds,
      xpSpentCents: safeXpSpentCents,
      targetItemId: targetItemId.trim(),
      sectorMode: safeSectorMode,
      clientSeed: safeClientSeed,
    });

    return NextResponse.json(result);
  } catch (error) {
    const msg = (error as Error).message || 'Error en la tirada de Upgrade';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
