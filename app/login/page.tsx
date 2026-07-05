'use client';

import { createBrowserClient } from '@/lib/supabase/client';
import FadeIn from '@/components/FadeIn';

export default function LoginPage() {
  const supabase = createBrowserClient();

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/tasks',
        queryParams: { access_type: 'offline', prompt: 'consent' },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <FadeIn>
      <div className="login-page">
        <main className="login-card">
          <h1 style={{ margin: 0, fontSize: '2.25rem' }}>EStiri</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: '1.05rem' }}>
            Inicia sesión para gestionar tus tareas y recompensas
          </p>
          <button className="btn-google" onClick={signIn}>
            Entrar con Google
          </button>
        </main>
      </div>
    </FadeIn>
  );
}
