'use client';

import React, { useEffect, useState } from 'react';
import { soundFX } from '@/lib/sound';
import { IconVolumeOn, IconVolumeOff } from './Icons';

export default function SoundToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(soundFX.isEnabled());
  }, []);

  function toggle() {
    const next = soundFX.toggleSound();
    setEnabled(next);
    if (next) soundFX.playClick();
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label="Conmutar sonidos"
      title={enabled ? 'Efectos de sonido activados' : 'Efectos de sonido desactivados'}
    >
      {enabled ? <IconVolumeOn size={17} /> : <IconVolumeOff size={17} />}
    </button>
  );
}
