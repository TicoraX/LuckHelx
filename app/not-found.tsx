import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '2.5rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            fontSize: '4rem',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-xp)',
            marginBottom: '0.5rem',
            lineHeight: 1,
          }}
        >
          404
        </div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Página no encontrada</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.8rem', fontSize: '0.95rem' }}>
          La ruta que intentas visitar no existe o fue reubicada en el sistema.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '0.65rem 1.4rem',
            background: 'var(--accent-primary)',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '4px',
            fontWeight: 600,
            fontSize: '0.95rem',
          }}
        >
          Volver al Inicio
        </Link>
      </div>
    </main>
  );
}
