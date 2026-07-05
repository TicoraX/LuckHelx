import { createServiceClient } from '@/lib/supabase/server';
import { getAuthedUser } from '@/lib/supabase/route-auth';
import { createGoogleTask } from '@/lib/google-tasks';
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
    .select('id, google_refresh_token, deepseek_calls_today, deepseek_calls_date')
    .eq('id', user.id)
    .single();

  if (!profile) return jsonWithCookies({ error: 'perfil no encontrado' }, { status: 404 });
  if (!profile.google_refresh_token) {
    return jsonWithCookies({ error: 'conecta tu cuenta de Google Tasks primero' }, { status: 400 });
  }

  const taskInput = { title: title.trim(), description: typeof description === 'string' ? description : '' };

  let created;
  try {
    created = await createGoogleTask(profile.google_refresh_token, taskInput);
  } catch {
    return jsonWithCookies({ error: 'no se pudo crear la tarea en Google Tasks' }, { status: 502 });
  }

  const { xpValue, xpReasoning, normalized } = await evaluateAndCacheXp(supabase, profile, taskInput);

  const { data: row } = await supabase
    .from('tasks')
    .upsert(
      {
        user_id: profile.id,
        google_task_id: created.googleTaskId,
        title: taskInput.title,
        description: taskInput.description,
        description_normalized: normalized,
        xp_value: xpValue,
        xp_reasoning: xpReasoning,
        status: 'evaluated',
      },
      { onConflict: 'user_id,google_task_id' }
    )
    .select('id, title, xp_value, status')
    .single();

  return jsonWithCookies({ task: row });
}
