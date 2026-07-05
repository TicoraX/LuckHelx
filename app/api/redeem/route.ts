import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { pickChestItem } from '@/lib/rewards';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  const { rewardId } = await request.json();
  const supabase = createServiceClient();

  const { data: reward } = await supabase.from('rewards').select('*').eq('id', rewardId).eq('user_id', user.id).single();
  if (!reward) return NextResponse.json({ error: 'recompensa no encontrada' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('xp_balance').eq('id', user.id).single();
  if (!profile || profile.xp_balance < reward.xp_cost) {
    return NextResponse.json({ error: 'xp insuficiente' }, { status: 400 });
  }

  let redeemedItem: { name: string; rarity?: string } = { name: reward.name };

  if (reward.type === 'chest') {
    const { data: chestItems } = await supabase
      .from('rewards')
      .select('id, name, rarity')
      .eq('user_id', user.id)
      .eq('type', 'chest_item');

    if (!chestItems || chestItems.length === 0) {
      return NextResponse.json({ error: 'no hay objetos definidos para este cofre' }, { status: 400 });
    }

    const picked = pickChestItem(chestItems.map((r) => ({ id: r.id, name: r.name, rarity: r.rarity })));
    redeemedItem = { name: picked.name, rarity: picked.rarity };
  }

  await supabase.rpc('increment_xp_balance', { p_user_id: user.id, p_amount: -reward.xp_cost });
  await supabase.from('redemptions').insert({ user_id: user.id, reward_id: reward.id, xp_spent: reward.xp_cost });

  return NextResponse.json({ redeemed: redeemedItem });
}
