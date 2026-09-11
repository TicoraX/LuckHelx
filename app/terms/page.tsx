import Link from 'next/link';

export const metadata = {
  title: 'Términos y Condiciones — EStiri',
  description: 'Términos y condiciones de uso del sistema de gamificación EStiri.',
};

export default function TermsPage() {
  return (
    <main
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '3rem 1.5rem',
        color: 'var(--text-main)',
        lineHeight: 1.6,
      }}
    >
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--accent-xp)', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Volver al Sistema
        </Link>
      </div>

      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Términos y Condiciones</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Última actualización: Septiembre 2026</p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>1. Uso del Software</h2>
        <p>
          EStiri es una aplicación de productividad y gamificación personal de código abierto. Se distribuye bajo el principio de &quot;tal cual&quot; (&quot;as is&quot;), sin garantías de ningún tipo respecto a disponibilidad ininterrumpida o idoneidad para un propósito particular.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>2. Economía de Simulación y No Valor Monetario Real</h2>
        <p>
          Los puntos de experiencia (XP), skins virtuales, cajas y transacciones generadas en la aplicación forman parte de una economía de entretenimiento y simulación diseñada para incentivar la constancia y el trabajo personal. No constituyen moneda real, criptoactivos ni activos de intercambio financiero comercial fuera del entorno del software.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>3. Propiedad Intelectual de Valve Corporation</h2>
        <p>
          Counter-Strike, CS2, los nombres de armas, calidades de skins y elementos visuales o auditivos asociados son marcas registradas o derechos de autor propiedad de Valve Corporation. EStiri no está afiliado, patrocinado ni respaldado por Valve Corporation.
        </p>
      </section>
    </main>
  );
}
