import Link from 'next/link';

export const metadata = {
  title: 'Política de Privacidad — EStiri',
  description: 'Información sobre el almacenamiento local y la privacidad de datos en EStiri.',
};

export default function PrivacyPage() {
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

      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Política de Privacidad</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Última actualización: Septiembre 2026</p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>1. Filosofía Local-First</h2>
        <p>
          EStiri opera bajo un modelo de arquitectura estrictamente <strong>local-first</strong>. Toda tu información personal, historial de tareas, saldo de XP, inventario de skins y transacciones se almacena de forma exclusiva en tu dispositivo local mediante una base de datos SQLite persistente.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>2. Tratamiento de Datos y Telemetría</h2>
        <p>
          No recopilamos telemetría de comportamiento, ni utilizamos cookies de seguimiento de terceros, rastreadores publicitarios ni píxeles analíticos. Ningún dato sensible sale de tu máquina a menos que configures explícitamente una clave de API externa para evaluación de tareas con modelos LLM.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>3. Servicios Externos de IA</h2>
        <p>
          Si proporcionas una clave de API propia (por ejemplo, DeepSeek), las descripciones de las tareas se transmiten de forma segura y directa a dicho proveedor únicamente para estimar el esfuerzo y recompensa en XP. EStiri no almacena ni retransmite tus claves privadas.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>4. Exportación y Respaldo</h2>
        <p>
          Eres el único dueño de tus datos. Puedes generar un respaldo integral en formato JSON o exportar tu historial a CSV en cualquier momento desde la interfaz del sistema.
        </p>
      </section>
    </main>
  );
}
