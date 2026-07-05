import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { syncProfileTasks } from '@/lib/sync';

// Vercel Cron always invokes via GET — this is a platform constraint, not a design choice.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, google_refresh_token, deepseek_calls_today, deepseek_calls_date');

  for (const profile of profiles ?? []) {
    await syncProfileTasks(supabase, profile);
  }

  return NextResponse.json({ ok: true });
}
