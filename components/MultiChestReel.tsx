'use client';

import { useEffect, useRef, useState } from 'react';
import {
  buildReel,
  CELL_GAP,
  COMPACT_CELL_WIDTH,
  COMPACT_VIEWPORT_PX,
  highestRarity,
  type ReelChestItem,
  reelTickTimes,
  SPIN_EASING,
  WINNER_INDEX,
} from '@/lib/chest-reel';
import { soundFX } from '@/lib/sound';
import Modal from './Modal';

// Celda compacta del 5x: la de la batalla 1v1 (150 px), para que cinco filas entren en pantalla.
const MULTI_CELL_WIDTH = 150;
const SPIN_DURATION_DEFAULT_MS = 6500;
// Mismos tiempos que ChestReel: tope de la preparación y ventaja del desbloqueo sobre el giro.
const PREPARE_CAP_MS = 2000;
const UNLOCK_LEAD_MS = 1000;
// Pausa con los carretes frenados antes de pasar a la grilla de resultados.
const HOLD_MS = 1400;

function rarityColor(item: ReelChestItem): string {
  // Los legendarios comparten el dorado anónimo: la tira no delata cuál cuchillo es.
  if (item.rarity === 'legendary') return 'var(--rarity-legendary)';
  return item.rarityColor ?? `var(--rarity-${item.rarity})`;
}

function preloadImages(urls: string[]): Promise<void> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.src = url;
        })
    )
  ).then(() => undefined);
}

interface Strip {
  items: ReelChestItem[];
  targetOffset: number;
}

/**
 * N carretes apilados que giran a la vez y frenan juntos. Sonido de una sola tanda: un
 * desbloqueo, un juego de ticks y un revelado con la rareza más alta. No nombra ningún premio:
 * los resultados los muestra la grilla que el padre abre en `onDone` / `onSkip`.
 */
export default function MultiChestReel({
  chestName,
  pool,
  winnerIds,
  spinDurationMs = SPIN_DURATION_DEFAULT_MS,
  onLanded,
  onDone,
  onSkip,
}: {
  chestName: string;
  pool: ReelChestItem[];
  winnerIds: string[];
  spinDurationMs?: number;
  /** Al frenar los carretes (suena el revelado). */
  onLanded: () => void;
  /** Tras la pausa con los carretes quietos. */
  onDone: () => void;
  /** Saltear (botón o Escape): el padre pasa a la grilla; desmontar corta ticks y desbloqueo. */
  onSkip: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [strips, setStrips] = useState<Strip[]>([]);
  const [cellWidth, setCellWidth] = useState(MULTI_CELL_WIDTH);
  const [preparing, setPreparing] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);

  const cancelTicksRef = useRef<(() => void) | null>(null);
  const stopUnlockRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cbRef = useRef({ onLanded, onDone });
  cbRef.current = { onLanded, onDone };

  useEffect(() => {
    let cancelled = false;
    const viewportWidth = viewportRef.current?.clientWidth ?? 700;
    const cw = window.matchMedia(`(max-width: ${COMPACT_VIEWPORT_PX}px)`).matches
      ? COMPACT_CELL_WIDTH
      : MULTI_CELL_WIDTH;
    const built = winnerIds.map((id) => buildReel(pool, id, cw, viewportWidth));
    setCellWidth(cw);
    setStrips(built);

    const winnerRarities = built.map((b) => b.items[WINNER_INDEX]?.rarity ?? 'common');
    const urls = Array.from(
      new Set(built.flatMap((b) => b.items.map((i) => i.image)).filter((u): u is string => !!u))
    );

    const ready = Promise.race([
      Promise.all([preloadImages(urls), soundFX.prepareCaseClips(PREPARE_CAP_MS)]),
      new Promise((resolve) => setTimeout(resolve, PREPARE_CAP_MS)),
    ]);

    let unlockPlayed = false;
    const startSpin = () => {
      if (cancelled) return;
      setPreparing(false);
      // Doble frame: el primero pinta las tiras en su posición inicial; la transición recién
      // arranca en el segundo, junto con los ticks.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          if (!unlockPlayed) soundFX.playCaseUnlock();
          // Todas las tiras miden lo mismo (misma celda y viewport): sus bordes cruzan juntos.
          cancelTicksRef.current = soundFX.scheduleReelTicks(
            reelTickTimes(spinDurationMs, built[0])
          );
          setSpinning(true);
        });
      });
      timersRef.current.push(
        setTimeout(() => {
          setLanded(true);
          soundFX.playReveal(highestRarity(winnerRarities));
          cbRef.current.onLanded();
          timersRef.current.push(setTimeout(() => cbRef.current.onDone(), HOLD_MS));
        }, spinDurationMs + 120)
      );
    };

    ready.then(() => {
      if (cancelled) return;
      stopUnlockRef.current = soundFX.playCaseUnlockClip();
      unlockPlayed = stopUnlockRef.current !== null;
      if (unlockPlayed) timersRef.current.push(setTimeout(startSpin, UNLOCK_LEAD_MS));
      else startSpin();
    });

    return () => {
      cancelled = true;
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current = [];
      cancelTicksRef.current?.();
      stopUnlockRef.current?.();
    };
    // Una apertura monta el componente una sola vez: repetir el efecto reiniciaría el giro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal onClose={onSkip} onEscape={onSkip} closeOnBackdrop={false}>
      <div className="modal-dialog multi-reel-dialog">
        <h2 className="multi-reel-title">
          Abriendo {winnerIds.length}x {chestName}
        </h2>
        <div
          className="multi-reel-rows"
          style={{
            ['--reel-cell-w' as string]: `${cellWidth}px`,
            ['--reel-cell-gap' as string]: `${CELL_GAP}px`,
          }}
        >
          {winnerIds.map((id, k) => (
            <div
              key={`${id}-${k}`}
              className="reel-viewport multi-reel-viewport"
              ref={k === 0 ? viewportRef : undefined}
            >
              {!preparing && strips[k] && (
                <>
                  <div className="reel-marker" />
                  <div
                    className="reel-track"
                    aria-hidden={!landed}
                    style={{
                      transform: `translateX(-${spinning ? strips[k].targetOffset : 0}px)`,
                      transition: spinning
                        ? `transform ${spinDurationMs}ms ${SPIN_EASING}`
                        : 'none',
                    }}
                  >
                    {strips[k].items.map((item, i) => {
                      const isLegendary = item.rarity === 'legendary';
                      const isWinner = landed && i === WINNER_INDEX;
                      return (
                        <div
                          key={i}
                          className={`reel-item multi-reel-item${isWinner ? ' is-winner' : ''}${isWinner && isLegendary ? ' is-legendary-winner' : ''}`}
                          style={{ ['--cell-rarity' as string]: rarityColor(item) }}
                        >
                          {isLegendary ? (
                            <span className="reel-item-star">★</span>
                          ) : item.image ? (
                            <img src={item.image} alt="" className="reel-item-img" />
                          ) : (
                            <span className="reel-item-blank" />
                          )}
                          <span title={isLegendary ? 'Objeto especial' : item.name}>
                            {isLegendary ? 'Objeto especial' : item.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="multi-reel-footer">
          <span className="reel-stage-hint">Escape para saltar</span>
          <button className="btn" onClick={onSkip}>
            Saltar
          </button>
        </div>
      </div>
    </Modal>
  );
}
