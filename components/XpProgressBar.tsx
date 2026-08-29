'use client';

import AnimatedNumber from './AnimatedNumber';
import { XP_SCALE } from '@/lib/xp';

// Un nivel sigue siendo 100 XP, que ahora son 100 * XP_SCALE unidades. El nivel es lo
// único que se mide en XP entero y no en unidades: subir de nivel cada centésima no seria
// un nivel.
const UNITS_PER_LEVEL = 100 * XP_SCALE;

export default function XpProgressBar({ xp }: { xp: number }) {
  const currentLevel = Math.floor(xp / UNITS_PER_LEVEL) + 1;
  const unitsInLevel = xp % UNITS_PER_LEVEL;
  const progressPercent = Math.min(100, Math.max(0, (unitsInLevel / UNITS_PER_LEVEL) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
        <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Nivel {currentLevel}</span>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          <strong style={{ color: 'var(--accent-xp)' }}>
            {/* El contador animado cuenta enteros: se le da el XP redondeado, y el valor
                exacto con centesimas vive en el saldo del pie. */}
            <AnimatedNumber value={Math.floor(unitsInLevel / XP_SCALE)} /> XP
          </strong>{' '}
          / 100 XP
        </span>
      </div>
      <div className="xp-progress-bar">
        <div className="xp-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}
