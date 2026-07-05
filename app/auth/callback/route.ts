import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/login', request.url));

  const response = NextResponse.redirect(new URL('/', request.url));

  // setAll must write onto the actual redirect response — a no-op here silently drops the
  // session cookies, so exchangeCodeForSession "succeeds" but the browser never gets logged in.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
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

  return response;
}
