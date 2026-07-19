'use client';

import React, { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { IconLightning, IconSync, IconChest } from '@/components/Icons';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [supabase] = useState(() => createBrowserClient());

  async function signIn() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/tasks',
          queryParams: { access_type: 'offline', prompt: 'consent' },
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div
      className="fade-in"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
      }}
    >
      <main
        className="glass-card"
        style={{
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
          padding: '3rem 2rem',
          border: '1px solid var(--border-hover)',
          boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            background: 'var(--accent-primary)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}
        >
          <IconLightning size={28} color="#ffffff" />
        </div>

        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Recompensas<span className="gradient-text">.</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          Transforma tus tareas diarias en XP y desbloquea recompensas reales.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            textAlign: 'left',
            marginBottom: '2rem',
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '1rem',
            borderRadius: '14px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
            <IconSync size={16} color="var(--accent-primary)" />
            <span>Sincronización directa con <strong>Google Tasks</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
            <IconLightning size={16} color="var(--accent-xp)" />
            <span>Gana puntos de <strong>XP por productividad</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
            <IconChest size={16} color="var(--accent-primary)" />
            <span>Canjea premios y abre <strong>Cofres del Tesoro</strong></span>
          </div>
        </div>

        <button
          onClick={signIn}
          disabled={loading}
          className="btn"
          style={{
            width: '100%',
            padding: '0.9rem 1.5rem',
            fontSize: '1.05rem',
            background: '#ffffff',
            color: '#0f172a',
            boxShadow: '0 4px 15px rgba(255, 255, 255, 0.2)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          {loading ? 'Conectando con Google...' : 'Entrar con Google'}
        </button>
      </main>
    </div>
  );
}
