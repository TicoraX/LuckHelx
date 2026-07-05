import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { syncProfileTasks } from '@/lib/sync';

export async function POST() {
  const cookieStore = cookies();
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) =>
          pendingCookies.push(...cookiesToSet),
      },
    }
  );

  function jsonWithCookies(body: unknown, init?: { status?: number }) {
    const res = NextResponse.json(body, init);
    pendingCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  }

  const { data: { user } } = await authClient.auth.getUser();
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
