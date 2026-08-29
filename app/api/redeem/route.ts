import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getXpBalance, getSaleEconomy } from '@/lib/settings-store';
import { getRewardById, redeemIfSufficient, getChestPool, WonItem } from '@/lib/rewards-store';
import { pickChestItem } from '@/lib/rewards';
import { formatXp } from '@/lib/xp';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'rewardId invalido' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'rewardId invalido' }, { status: 400 });
  }

  const { rewardId } = body as { rewardId: unknown };
  if (typeof rewardId !== 'string' || rewardId.length === 0) {
    return NextResponse.json({ error: 'rewardId invalido' }, { status: 400 });
  }

  const db = getDb();
  const reward = getRewardById(db, rewardId);
  if (!reward) return NextResponse.json({ error: 'recompensa no encontrada' }, { status: 404 });

  let redeemedItem: { id?: string; name: string; rarity?: string; image?: string | null; rarity_color?: string | null } = { name: reward.name };
  let wonItem: WonItem | undefined;

  if (reward.type === 'chest') {
    const chestItems = getChestPool(db, reward.id);
    if (chestItems.length === 0) {
      return NextResponse.json({ error: 'no hay objetos definidos para este cofre' }, { status: 400 });
    }
    const picked = pickChestItem(
      chestItems.map((r) => ({ id: r.id, name: r.name, rarity: r.rarity as 'common' | 'rare' | 'epic' | 'legendary' }))
    );
    const pickedRow = chestItems.find((r) => r.id === picked.id)!;
    redeemedItem = { id: picked.id, name: picked.name, rarity: picked.rarity, image: pickedRow.image, rarity_color: pickedRow.rarity_color };
    wonItem = { id: picked.id, name: picked.name, rarity: picked.rarity, image: pickedRow.image };
  } else if (reward.type === 'chest_item') {
    return NextResponse.json({ error: 'no se puede canjear un objeto de cofre' }, { status: 400 });
  }

  // La llave es lo que evita que abrir cajas imprima XP ahora que se pueden revender los
  // premios: la caja más barata del catálogo cuesta 0,39 XP y tiene cuchillos adentro, y
  // sin un costo fijo por apertura el valor esperado supera al precio. Mismo freno que
  // usa CS2 real, donde la llave sale más cara que la caja.
  const keyCost = reward.type === 'chest' ? getSaleEconomy(db).keyCostXpUnits : 0;

  const redeemed = redeemIfSufficient(db, rewardId, wonItem, keyCost);
  if (!redeemed) {
    // Cuánto falta, no solo que falta: el cliente no puede calcularlo sin volver a pedir
    // el balance, y para entonces ya perdió el contexto de qué intentó canjear.
    const missing = reward.xp_cost + keyCost - getXpBalance(db);
    return NextResponse.json({ error: `te faltan ${formatXp(missing)} XP para canjear esto` }, { status: 400 });
  }

  // El nombre del cofre viaja aparte del premio: el encabezado del carrete anuncia la
  // caja que se abre, no lo que salió. Mandar solo `redeemed` obligaba a la UI a titular
  // con el premio y arruinaba los 5,5 segundos de giro.
  return NextResponse.json({ chestName: reward.name, redeemed: redeemedItem, keyCost });
}
