import { createServiceClient } from '@/lib/supabase/server';
import { getAuthedUser } from '@/lib/supabase/route-auth';

export async function POST(request: Request) {
  const { user, jsonWithCookies } = await getAuthedUser();
  if (!user) return jsonWithCookies({ error: 'no autenticado' }, { status: 401 });

  const { taskId } = await request.json();
  if (typeof taskId !== 'string' || taskId.length === 0) {
    return jsonWithCookies({ error: 'taskId invalido' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: task } = await supabase
    .from('tasks')
    .select('id, xp_value, status')
    .eq('id', taskId)
    .eq('user_id', user.id)
    .single();

  if (!task) return jsonWithCookies({ error: 'tarea no encontrada' }, { status: 404 });
  if (task.status === 'credited') {
    return jsonWithCookies({ error: 'esta tarea ya fue acreditada' }, { status: 400 });
  }

  await supabase
    .from('tasks')
    .update({ status: 'credited', completed_at: new Date().toISOString() })
    .eq('id', task.id);

  await supabase.rpc('increment_xp_balance', { p_user_id: user.id, p_amount: task.xp_value ?? 0 });

  return jsonWithCookies({ ok: true, xpAwarded: task.xp_value ?? 0 });
}
