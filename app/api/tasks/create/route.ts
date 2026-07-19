import { createServiceClient } from '@/lib/supabase/server';
import { getAuthedUser } from '@/lib/supabase/route-auth';
import { evaluateAndCacheXp } from '@/lib/sync';

export async function POST(request: Request) {
  const { user, jsonWithCookies } = await getAuthedUser();
  if (!user) return jsonWithCookies({ error: 'no autenticado' }, { status: 401 });

  const { title, description } = await request.json();
  if (typeof title !== 'string' || title.trim().length === 0) {
    return jsonWithCookies({ error: 'title invalido' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, deepseek_calls_today, deepseek_calls_date')
    .eq('id', user.id)
    .single();

  if (!profile) return jsonWithCookies({ error: 'perfil no encontrado' }, { status: 404 });

  const taskInput = { title: title.trim(), description: typeof description === 'string' ? description : '' };

  const { xpValue, xpReasoning, normalized } = await evaluateAndCacheXp(supabase, profile, taskInput);

  const { data: row } = await supabase
    .from('tasks')
    .insert({
      user_id: profile.id,
      title: taskInput.title,
      description: taskInput.description,
      description_normalized: normalized,
      xp_value: xpValue,
      xp_reasoning: xpReasoning,
      status: 'evaluated',
    })
    .select('id, title, xp_value, status')
    .single();

  return jsonWithCookies({ task: row });
}
