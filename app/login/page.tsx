'use client';

import { createBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createBrowserClient();

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/tasks.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main>
      <button onClick={signIn}>Entrar con Google</button>
    </main>
  );
}
