import { createServiceClient } from '@/lib/supabase/server';
import { getAuthedUser } from '@/lib/supabase/route-auth';
import { syncProfileTasks } from '@/lib/sync';

export async function POST() {
  const { user, jsonWithCookies } = await getAuthedUser();
  if (!user) return jsonWithCookies({ error: 'no autenticado' }, { status: 401 });

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

  await syncProfileTasks(supabase, profile);

  return jsonWithCookies({ ok: true });
}
