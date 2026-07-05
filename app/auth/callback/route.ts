import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/login', request.url));

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) return NextResponse.redirect(new URL('/login', request.url));

  const providerRefreshToken = (data.session as any).provider_refresh_token;
  if (providerRefreshToken) {
    const service = createServiceClient();
    await service
      .from('profiles')
      .upsert({ id: data.user!.id, google_refresh_token: providerRefreshToken });
  }

  return NextResponse.redirect(new URL('/', request.url));
}
