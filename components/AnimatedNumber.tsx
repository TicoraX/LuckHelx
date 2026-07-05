'use client';

import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

export default function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const [pulsing, setPulsing] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current === value) return;

    const controls = animate(prevValue.current, value, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });

    setPulsing(true);
    const pulseTimeout = setTimeout(() => setPulsing(false), 600);

    prevValue.current = value;
    return () => {
      controls.stop();
      clearTimeout(pulseTimeout);
    };
  }, [value]);

  return <span className={pulsing ? 'pop-in' : undefined}>{display}</span>;
}
