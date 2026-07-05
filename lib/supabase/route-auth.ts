import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Shared by every API route handler that needs the logged-in user: verifies the session via a
// real round-trip (auth.getUser()) rather than trusting anything client-supplied, and replays any
// session-refresh cookie writes onto whichever JSON response the route ends up returning — a
// no-op setAll silently drops a refreshed token and logs the user out on their next request.
export async function getAuthedUser() {
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

  const { data: { user } } = await authClient.auth.getUser();

  function jsonWithCookies(body: unknown, init?: { status?: number }) {
    const res = NextResponse.json(body, init);
    pendingCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  }

  return { user, jsonWithCookies };
}
