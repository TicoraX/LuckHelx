'use client';

import { useEffect, useRef, useState } from 'react';
import {
  buildReel,
  CELL_GAP,
  CELL_WIDTH,
  type ReelChestItem,
  reelTickTimes,
  SPIN_EASING,
  WINNER_INDEX,
} from '@/lib/chest-reel';
import { soundFX } from '@/lib/sound';

// Default: lo que tarda el giro en CS2, unos 6,5 s. Ajustes puede cambiarlo; los ticks se
// calculan con el valor que llegue, así que el sonido sigue a la tira.
const SPIN_DURATION_DEFAULT_MS = 6500;

// Techo de la etapa de preparación. Las imágenes vienen del CDN de Steam: si tarda, se
// arranca igual con lo que haya llegado. Un carrete con algún hueco es mejor que una app
// esperando a un servidor de terceros.
const PREPARE_CAP_MS = 2000;

function rarityColor(item: ReelChestItem): string {
  // Los legendarios usan el token y no su color real: el carrete no puede delatar cuál
  // cuchillo es antes de frenar, así que todos comparten el mismo dorado anónimo.
  if (item.rarity === 'legendary') return 'var(--rarity-legendary)';
  return item.rarityColor ?? `var(--rarity-${item.rarity})`;
}

/** Calienta el caché del navegador. Cuando el <img> del carrete monte, ya está en disco. */
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

export default function ChestReel({
  pool,
  winnerId,
  chestImage,
  spinDurationMs = SPIN_DURATION_DEFAULT_MS,
  skip,
  onDone,
}: {
  pool: ReelChestItem[];
  winnerId: string;
  chestImage?: string | null;
  spinDurationMs?: number;
  skip: boolean;
  onDone: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<ReelChestItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [preparing, setPreparing] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);

  const cancelTicksRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    const viewportWidth = viewportRef.current?.clientWidth ?? 700;
    const { items: reelItems, targetOffset } = buildReel(pool, winnerId, CELL_WIDTH, viewportWidth);
    setItems(reelItems);

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (skip || prefersReduced) {
      setPreparing(false);
      setOffset(targetOffset);
      setLanded(true);
      const winnerRarity = (reelItems[WINNER_INDEX]?.rarity ?? 'common') as
        | 'common'
        | 'rare'
        | 'epic'
        | 'legendary';
      soundFX.playRarityDrop(winnerRarity);
      doneRef.current();
      return;
    }

    // Etapa de preparación: mientras se muestra la caja, se bajan las imágenes que va a
    // desfilar la tira. Sin esto, el giro arrancaba con las imágenes a medio bajar.
    const urls = Array.from(new Set(reelItems.map((i) => i.image).filter((u): u is string => !!u)));

    const ready = Promise.race([
      Promise.all([preloadImages(urls), soundFX.prepareOpeningSample(PREPARE_CAP_MS)]),
      new Promise((resolve) => setTimeout(resolve, PREPARE_CAP_MS)),
    ]);

    ready.then(() => {
      if (cancelled) return;
      setPreparing(false);

      // Doble frame a propósito: el primero le da a React el commit de la tira y al
      // navegador su pintado en la posición inicial. Arrancar la transición en el mismo
      // frame que el montaje la haría saltar al destino sin animar. Recién en el segundo
      // frame, con la tira ya en pantalla, se agendan los ticks y empieza el giro juntos.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          soundFX.playCaseUnlock();
          // La grabacion de CS2 si esta en public/sounds/; si no, los ticks agendados.
          soundFX.startOpeningSample().catch(() => {
            if (cancelled) return;
            cancelTicksRef.current = soundFX.scheduleReelTicks(reelTickTimes(spinDurationMs));
          });
          setSpinning(true);
          setOffset(targetOffset);
        });
      });

      timerRef.current = setTimeout(() => {
        setLanded(true);
        const winnerRarity = (reelItems[WINNER_INDEX]?.rarity ?? 'common') as
          | 'common'
          | 'rare'
          | 'epic'
          | 'legendary';
        soundFX.playRarityDrop(winnerRarity);
        doneRef.current();
      }, spinDurationMs + 120);
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      // Saltear (click o Escape) remonta el carrete: los ticks que faltaban no suenan.
      cancelTicksRef.current?.();
      soundFX.stopOpeningSample();
    };
    // Una apertura monta el carrete una sola vez: repetir el efecto reiniciaría el giro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="reel-viewport"
      ref={viewportRef}
      style={{
        ['--reel-cell-w' as string]: `${CELL_WIDTH}px`,
        ['--reel-cell-gap' as string]: `${CELL_GAP}px`,
      }}
    >
      {preparing ? (
        <div className="reel-prepare">
          {chestImage ? (
            <img src={chestImage} alt="" />
          ) : (
            <span className="reel-prepare-fallback" />
          )}
        </div>
      ) : (
        <>
          <div className="reel-marker" />
          <div
            className="reel-track"
            style={{
              transform: `translateX(-${offset}px)`,
              transition: spinning ? `transform ${spinDurationMs}ms ${SPIN_EASING}` : 'none',
            }}
          >
            {items.map((item, i) => {
              const isLegendary = item.rarity === 'legendary';
              return (
                <div
                  key={i}
                  className={`reel-item${landed && i === WINNER_INDEX ? ' is-winner' : ''}${landed && i === WINNER_INDEX && isLegendary ? ' is-legendary-winner' : ''}`}
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
  );
}
