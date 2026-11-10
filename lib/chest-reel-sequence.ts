'use client';

import { useEffect, useRef, useState } from 'react';
import { preloadImages } from './chest-reel';
import type { Rarity } from './rewards';
import { soundFX } from './sound';

export const REEL_PREPARE_CAP_MS = 2000;
export const REEL_UNLOCK_LEAD_MS = 1000;

export interface ReelSequenceOptions {
  /** Indica si la tira ya fue construida con el DOM montado y viewport medido */
  ready: boolean;
  /** URLs de imágenes que deben precargarse durante la preparación */
  imageUrls: string[];
  /** Duración total del giro en milisegundos */
  spinDurationMs: number;
  /** Si el giro debe saltearse inmediatamente (p. ej. botón saltar) */
  skip?: boolean;
  /** Rareza ganadora que sonará en el revelado */
  winnerRarity: Rarity;
  /** Retorna los instantes (ms) para programar los ticks de audio */
  getTickTimes: () => number[];
  /** Pausa opcional con el carrete frenado antes de llamar a onDone (p. ej. en MultiChestReel) */
  holdMs?: number;
  /** Callback al frenar el carrete (en landed) */
  onLanded?: () => void;
  /** Callback final de la secuencia */
  onDone: () => void;
  /** Techo máximo de espera en preparación (default 2000 ms) */
  prepareCapMs?: number;
  /** Ventaja de sonido del clip de desbloqueo antes de arrancar (default 1000 ms) */
  unlockLeadMs?: number;
}

export interface ReelSequenceState {
  preparing: boolean;
  spinning: boolean;
  landed: boolean;
}

/**
 * Prepara las imágenes y clips de audio con un techo máximo de tiempo.
 */
export async function prepareReelMedia(
  urls: string[],
  capMs = REEL_PREPARE_CAP_MS
): Promise<void> {
  await Promise.race([
    Promise.all([preloadImages(urls), soundFX.prepareCaseClips(capMs)]),
    new Promise((resolve) => setTimeout(resolve, capMs)),
  ]);
}

/**
 * Hook reactivo compartido que unifica la secuencia de preparación, desbloqueo,
 * doble frame de commit/paint, scheduling de ticks y revelado de ChestReel y MultiChestReel (#15).
 */
export function useChestReelSequence({
  ready,
  imageUrls,
  spinDurationMs,
  skip = false,
  winnerRarity,
  getTickTimes,
  holdMs = 0,
  onLanded,
  onDone,
  prepareCapMs = REEL_PREPARE_CAP_MS,
  unlockLeadMs = REEL_UNLOCK_LEAD_MS,
}: ReelSequenceOptions): ReelSequenceState {
  const [preparing, setPreparing] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);

  const cancelTicksRef = useRef<(() => void) | null>(null);
  const stopUnlockRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const callbacksRef = useRef({ onLanded, onDone, getTickTimes, winnerRarity });
  callbacksRef.current = { onLanded, onDone, getTickTimes, winnerRarity };

  const cleanup = () => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    cancelTicksRef.current?.();
    stopUnlockRef.current?.();
  };

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (skip || prefersReduced) {
      setPreparing(false);
      setLanded(true);
      const timer = setTimeout(() => {
        soundFX.playReveal(callbacksRef.current.winnerRarity);
        callbacksRef.current.onLanded?.();
        callbacksRef.current.onDone();
      }, 0);
      timersRef.current.push(timer);
      return cleanup;
    }

    let unlockPlayed = false;

    const startSpin = () => {
      if (cancelled) return;
      setPreparing(false);

      // Doble frame a propósito: el primero le da a React el commit de la tira y al
      // navegador su pintado en la posición inicial. Arrancar la transición en el mismo
      // frame que el montaje la haría saltar al destino sin animar. Recién en el segundo
      // frame, con la tira ya en pantalla, se agendan los ticks y empieza el giro juntos.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          if (!unlockPlayed) soundFX.playCaseUnlock();
          const tickTimes = callbacksRef.current.getTickTimes();
          cancelTicksRef.current = soundFX.scheduleReelTicks(tickTimes);
          setSpinning(true);
        });
      });

      const landTimer = setTimeout(() => {
        setLanded(true);
        soundFX.playReveal(callbacksRef.current.winnerRarity);
        callbacksRef.current.onLanded?.();

        if (holdMs > 0) {
          const holdTimer = setTimeout(() => {
            callbacksRef.current.onDone();
          }, holdMs);
          timersRef.current.push(holdTimer);
        } else {
          callbacksRef.current.onDone();
        }
      }, spinDurationMs + 120);

      timersRef.current.push(landTimer);
    };

    prepareReelMedia(imageUrls, prepareCapMs).then(() => {
      if (cancelled) return;
      stopUnlockRef.current = soundFX.playCaseUnlockClip();
      unlockPlayed = stopUnlockRef.current !== null;
      if (unlockPlayed) {
        const leadTimer = setTimeout(startSpin, unlockLeadMs);
        timersRef.current.push(leadTimer);
      } else {
        startSpin();
      }
    });

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return { preparing, spinning, landed };
}
