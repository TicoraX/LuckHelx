import { createServiceClient } from '@/lib/supabase/server';
import { getAuthedUser } from '@/lib/supabase/route-auth';
import { pickChestItem } from '@/lib/rewards';

export async function POST(request: Request) {
  const { user, jsonWithCookies } = await getAuthedUser();
  if (!user) return jsonWithCookies({ error: 'no autenticado' }, { status: 401 });

  const { rewardId } = await request.json();
  if (typeof rewardId !== 'string' || rewardId.length === 0) {
    return jsonWithCookies({ error: 'rewardId invalido' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: reward } = await supabase.from('rewards').select('*').eq('id', rewardId).eq('user_id', user.id).single();
  if (!reward) return jsonWithCookies({ error: 'recompensa no encontrada' }, { status: 404 });

  let redeemedItem: { id?: string; name: string; rarity?: string } = { name: reward.name };

  if (reward.type === 'chest') {
    const { data: chestItems } = await supabase
      .from('rewards')
      .select('id, name, rarity')
      .eq('user_id', user.id)
      .eq('type', 'chest_item');

    if (!chestItems || chestItems.length === 0) {
      return jsonWithCookies({ error: 'no hay objetos definidos para este cofre' }, { status: 400 });
    }

    const picked = pickChestItem(chestItems.map((r) => ({ id: r.id, name: r.name, rarity: r.rarity })));
    redeemedItem = { id: picked.id, name: picked.name, rarity: picked.rarity };
  }

  // Atomic check-and-deduct in one statement — closes the race where two concurrent
  // requests could both read a sufficient balance before either decrement lands.
  const { data: newBalance } = await supabase.rpc('redeem_xp_if_sufficient', {
    p_user_id: user.id,
    p_cost: reward.xp_cost,
  });
  if (newBalance === null) {
    return jsonWithCookies({ error: 'xp insuficiente' }, { status: 400 });
  }

  await supabase.from('redemptions').insert({ user_id: user.id, reward_id: reward.id, xp_spent: reward.xp_cost });

  return jsonWithCookies({ redeemed: redeemedItem });
}
