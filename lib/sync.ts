import { SupabaseClient } from '@supabase/supabase-js';
import { evaluateTask } from './deepseek';
import { normalizeDescription } from './xp';

const DAILY_LIMIT = Number(process.env.DEEPSEEK_DAILY_LIMIT ?? 50);

export interface SyncProfile {
  id: string;
  deepseek_calls_today: number;
  deepseek_calls_date: string;
}

// Shared by the sync loop and the "create task" route — same cache-then-rate-limit-then-call
// decision either way, just called once per task instead of in a loop.
export async function evaluateAndCacheXp(
  supabase: SupabaseClient,
  profile: Pick<SyncProfile, 'id' | 'deepseek_calls_today' | 'deepseek_calls_date'>,
  task: { title: string; description: string }
): Promise<{ xpValue: number; xpReasoning: string; normalized: string }> {
  const normalized = normalizeDescription(task.description || task.title);

  const { data: cached } = await supabase
    .from('tasks')
    .select('xp_value, xp_reasoning')
    .eq('user_id', profile.id)
    .not('xp_value', 'is', null)
    .eq('description_normalized', normalized)
    .limit(1)
    .maybeSingle();

  if (cached) {
    return { xpValue: cached.xp_value, xpReasoning: cached.xp_reasoning, normalized };
  }

  const isNewDay = profile.deepseek_calls_date !== new Date().toISOString().slice(0, 10);
  const callsMadeToday = isNewDay ? 0 : profile.deepseek_calls_today;

  if (callsMadeToday >= DAILY_LIMIT) {
    return { xpValue: 5, xpReasoning: 'limite diario de evaluaciones alcanzado, xp minimo asignado', normalized };
  }

  const evaluated = await evaluateTask({ title: task.title, description: task.description });
  await supabase.rpc('increment_deepseek_calls', { p_user_id: profile.id });
  return { xpValue: evaluated.xp, xpReasoning: evaluated.reasoning, normalized };
}
