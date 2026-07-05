import { SupabaseClient } from '@supabase/supabase-js';
import { fetchGoogleTasks, diffTasks, LocalTask } from './google-tasks';
import { evaluateTask } from './deepseek';
import { normalizeDescription } from './xp';

const DAILY_LIMIT = Number(process.env.DEEPSEEK_DAILY_LIMIT ?? 50);

export interface SyncProfile {
  id: string;
  google_refresh_token: string | null;
  deepseek_calls_today: number;
  deepseek_calls_date: string;
}

// Shared by the periodic cron sync and the user-triggered "sync now" button — same logic,
// just a different caller and a single profile instead of a loop over all of them.
export async function syncProfileTasks(supabase: SupabaseClient, profile: SyncProfile) {
  if (!profile.google_refresh_token) return;

  let remoteTasks;
  try {
    remoteTasks = await fetchGoogleTasks(profile.google_refresh_token);
  } catch {
    // Token revoked or Google API down for this user — caller decides how to handle skipping.
    return;
  }

  const { data: localTasks } = await supabase
    .from('tasks')
    .select('google_task_id, status')
    .eq('user_id', profile.id);

  const local: LocalTask[] = (localTasks ?? []).map((t) => ({
    googleTaskId: t.google_task_id,
    status: t.status,
  }));

  const { newTasks, newlyCompleted } = diffTasks(remoteTasks, local);

  const isNewDay = profile.deepseek_calls_date !== new Date().toISOString().slice(0, 10);
  let callsMadeToday = isNewDay ? 0 : profile.deepseek_calls_today;

  for (const task of newTasks) {
    const normalized = normalizeDescription(task.description || task.title);

    const { data: cached } = await supabase
      .from('tasks')
      .select('xp_value, xp_reasoning')
      .eq('user_id', profile.id)
      .not('xp_value', 'is', null)
      .eq('description_normalized', normalized)
      .limit(1)
      .maybeSingle();

    let xpValue: number;
    let xpReasoning: string;

    if (cached) {
      xpValue = cached.xp_value;
      xpReasoning = cached.xp_reasoning;
    } else if (callsMadeToday >= DAILY_LIMIT) {
      xpValue = 5;
      xpReasoning = 'limite diario de evaluaciones alcanzado, xp minimo asignado';
    } else {
      const evaluated = await evaluateTask({ title: task.title, description: task.description });
      xpValue = evaluated.xp;
      xpReasoning = evaluated.reasoning;
      const { data: newCount } = await supabase.rpc('increment_deepseek_calls', { p_user_id: profile.id });
      callsMadeToday = newCount ?? callsMadeToday + 1;
    }

    await supabase.from('tasks').upsert(
      {
        user_id: profile.id,
        google_task_id: task.googleTaskId,
        title: task.title,
        description: task.description,
        description_normalized: normalized,
        xp_value: xpValue,
        xp_reasoning: xpReasoning,
        status: 'evaluated',
      },
      { onConflict: 'user_id,google_task_id', ignoreDuplicates: true }
    );
  }

  for (const completedTask of newlyCompleted) {
    const { data: taskRow } = await supabase
      .from('tasks')
      .select('id, xp_value')
      .eq('user_id', profile.id)
      .eq('google_task_id', completedTask.googleTaskId)
      .single();

    if (!taskRow) continue;

    await supabase
      .from('tasks')
      .update({ status: 'credited', completed_at: new Date().toISOString() })
      .eq('id', taskRow.id);

    await supabase.rpc('increment_xp_balance', { p_user_id: profile.id, p_amount: taskRow.xp_value ?? 0 });
  }
}
