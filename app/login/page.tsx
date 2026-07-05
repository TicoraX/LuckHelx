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
    <div className="login-page">
      <main className="login-card">
        <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(to right, #a855f7, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          EStiri
        </h1>
        <p style={{ color: '#94a3b8', marginTop: '1rem', fontSize: '1.1rem' }}>
          Inicia sesión para gestionar tus tareas y recompensas
        </p>
        <button className="btn-google" onClick={signIn}>
          Entrar con Google
        </button>
      </main>
    </div>
  );
}
