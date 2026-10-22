'use client';

import { useCallback, useEffect, useRef } from 'react';
import { soundFX } from '@/lib/sound';
import type { UpgradeCalculation, UpgradeOutcome } from '@/lib/upgrade';

export interface UpgradeWheelProps {
  calculation: UpgradeCalculation;
  isSpinning: boolean;
  targetRollAngle: number | null; // Ángulo [0, 360) calculado por el servidor
  outcome: UpgradeOutcome | null;
  onSpinEnd?: () => void;
  size?: number;
  className?: string;
}

export default function UpgradeWheel({
  calculation,
  isSpinning,
  targetRollAngle,
  outcome,
  onSpinEnd,
  size = 320,
  className = '',
}: UpgradeWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentAngleRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const lastTickIndexRef = useRef(0);

  // Dibuja el estado completo del Canvas en un ángulo dado de la flecha
  const drawWheel = useCallback(
    (angleDeg: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const radius = width / 2 - 20;

      ctx.clearRect(0, 0, width, height);

      // 1. Fondo del Dial / Sector de Pérdida (Rojo carbón sutil)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#141820';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#2b3442';
      ctx.stroke();
      ctx.restore();

      // 2. Sector Verde de Victoria (CS2 Emerald)
      // 0 grados es las 12 en punto (-Math.PI / 2)
      const startAngleRad = (calculation.sectorStartAngle * Math.PI) / 180 - Math.PI / 2;
      const endAngleRad = (calculation.sectorEndAngle * Math.PI) / 180 - Math.PI / 2;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius - 2, startAngleRad, endAngleRad, false);
      ctx.closePath();

      const greenGrad = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
      greenGrad.addColorStop(0, '#10b981');
      greenGrad.addColorStop(1, '#059669');
      ctx.fillStyle = greenGrad;
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#34d399';
      ctx.stroke();
      ctx.restore();

      // 3. Ticks Perimetrales de Precisión (cada 15 grados)
      ctx.save();
      for (let i = 0; i < 24; i++) {
        const deg = i * 15;
        const rad = (deg * Math.PI) / 180 - Math.PI / 2;
        const x1 = cx + (radius - 4) * Math.cos(rad);
        const y1 = cy + (radius - 4) * Math.sin(rad);
        const x2 = cx + (radius - 14) * Math.cos(rad);
        const y2 = cy + (radius - 14) * Math.sin(rad);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = i % 2 === 0 ? 3 : 1.5;
        ctx.stroke();
      }
      ctx.restore();

      // 4. Borde Exterior Metálico CS2 con Bisel
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#1e2430';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius + 4, 0, 2 * Math.PI);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3b4556';
      ctx.stroke();
      ctx.restore();

      // 5. Centro / Hub Fijo con Porcentaje y Multiplicador
      const hubRadius = radius * 0.46;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#11141a';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#374151';
      ctx.stroke();

      // Texto de Probabilidad
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 32px monospace';
      ctx.fillStyle = '#10b981';
      ctx.fillText(`${calculation.winPercentage.toFixed(2)}%`, cx, cy - 12);

      // Texto de Multiplicador
      ctx.font = '700 19px monospace';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(`${calculation.multiplier}x`, cx, cy + 20);
      ctx.restore();

      // 6. LA FLECHA GIRATORIA (Aguja CS2)
      // angleDeg: 0° apunta a las 12 en punto
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((angleDeg * Math.PI) / 180);

      // Sombra de la aguja
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 3;

      // Cuerpo de la aguja
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-2, -radius + 32);
      ctx.lineTo(2, -radius + 32);
      ctx.lineTo(4, 0);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();

      // Punta triangular afilada
      ctx.beginPath();
      ctx.moveTo(0, -radius + 6);
      ctx.lineTo(-11, -radius + 30);
      ctx.lineTo(11, -radius + 30);
      ctx.closePath();
      ctx.fillStyle = '#ffd700';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#d97706';
      ctx.stroke();

      // Perno central
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, 2 * Math.PI);
      ctx.fillStyle = '#181d26';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffd700';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffd700';
      ctx.fill();

      ctx.restore();
    },
    [calculation]
  );

  // Redibujar rueda estática al montar o cambiar cálculos
  useEffect(() => {
    drawWheel(currentAngleRef.current);
  }, [drawWheel]);

  // Manejo de la cinemática de giro con física real
  // El callback va por ref: el padre lo recrea en cada render, y como dependencia del efecto
  // reiniciaba el giro a mitad de camino.
  const onSpinEndRef = useRef(onSpinEnd);
  onSpinEndRef.current = onSpinEnd;

  useEffect(() => {
    if (!isSpinning || targetRollAngle === null) return;

    soundFX.playUpgradeWhoosh();

    const startAngle = currentAngleRef.current % 360;
    // 5 vueltas completas + alineación con el ángulo determinista del servidor
    const totalAngleDelta = 5 * 360 + ((targetRollAngle - startAngle + 360) % 360);
    const targetFinalAngle = currentAngleRef.current + totalAngleDelta;
    // Con reduced motion la aguja cae directo en el resultado.
    const durationMs = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 3200;
    const startTime = performance.now();

    lastTickIndexRef.current = Math.floor(currentAngleRef.current / 20);

    const animateFrame = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = durationMs === 0 ? 1 : Math.min(1, elapsed / durationMs);

      // Curva de desaceleración CS2: cubic-ease-out
      const ease = 1 - (1 - progress) ** 3;
      const angleNow = currentAngleRef.current + totalAngleDelta * ease;

      // Sonido de ticks mecánicos sincronizados con el paso de los ángulos
      const currentTickIndex = Math.floor(angleNow / 20);
      if (currentTickIndex > lastTickIndexRef.current) {
        lastTickIndexRef.current = currentTickIndex;
        const pitchRatio = 1.4 - progress * 0.7; // Pitch disminuye a medida que frena
        soundFX.playUpgradeSpinTick(pitchRatio);
      }

      drawWheel(angleNow);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animateFrame);
      } else {
        // Giro completado: clavar la aguja exactamente en el resultado final
        currentAngleRef.current = targetFinalAngle;
        drawWheel(targetFinalAngle);

        if (outcome === 'won') {
          soundFX.playUpgradeWin();
        } else {
          soundFX.playUpgradeLoss();
        }

        onSpinEndRef.current?.();
      }
    };

    animFrameRef.current = requestAnimationFrame(animateFrame);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isSpinning, targetRollAngle, drawWheel, outcome]);

  return (
    <div
      className={`upgrade-wheel-canvas-container ${className}`}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        width={size * 2}
        height={size * 2}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'block',
          borderRadius: '50%',
          boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
        }}
      />
    </div>
  );
}
