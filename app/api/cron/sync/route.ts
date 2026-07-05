import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { syncProfileTasks } from '@/lib/sync';

function isAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never authorize against an unset secret

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authHeader ?? '');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Vercel Cron always invokes via GET — this is a platform constraint, not a design choice.
export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'))) {
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
