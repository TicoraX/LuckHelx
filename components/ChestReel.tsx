'use client';

import { useEffect, useRef, useState } from 'react';
import { buildReel, ReelChestItem, CELL_WIDTH, CELL_GAP, WINNER_INDEX } from '@/lib/chest-reel';
import { soundFX } from '@/lib/sound';

// Calzado contra la grabación real: en el archivo, el carrete corre unos 6,5s desde que
// la caja se abre hasta que aparece el arma. Si cambiás el sample, este número y
// OPENING_START_S en lib/sound.ts son los dos que hay que mover.
const SPIN_DURATION_MS = 6500;
const SPIN_EASING = 'cubic-bezier(0.12, 0.8, 0.18, 1)';

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
  skip,
  onDone,
}: {
  pool: ReelChestItem[];
  winnerId: string;
  chestImage?: string | null;
  skip: boolean;
  onDone: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<ReelChestItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [preparing, setPreparing] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);

  const lastCellRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    const viewportWidth = viewportRef.current?.clientWidth ?? 700;
    const { items: reelItems, targetOffset } = buildReel(pool, winnerId, CELL_WIDTH, viewportWidth);
    setItems(reelItems);

    if (skip) {
      setPreparing(false);
      setOffset(targetOffset);
      setLanded(true);
      doneRef.current();
      return;
    }

    // Etapa de preparación: mientras se muestra la caja, se bajan las imágenes que va a
    // desfilar la tira y se deja el audio decodificado. Sin esto, el giro arrancaba con
    // las imágenes a medio bajar y el sonido siempre le ganaba la carrera a la animación,
    // porque la transición de CSS no se compromete hasta el frame siguiente.
    const urls = Array.from(new Set(reelItems.map((i) => i.image).filter((u): u is string => !!u)));

    const ready = Promise.race([
      Promise.all([preloadImages(urls), soundFX.prepareOpeningSample(PREPARE_CAP_MS)]),
      new Promise((resolve) => setTimeout(resolve, PREPARE_CAP_MS)),
    ]);

    ready.then(() => {
      if (cancelled) return;
      setPreparing(false);

      let synthTicks = false;

      // Doble frame a propósito: el primero le da a React el commit de la tira y al
      // navegador su pintado en la posición inicial. Arrancar la transición en el mismo
      // frame que el montaje la haría saltar al destino sin animar. Recién en el segundo
      // frame, con la tira ya en pantalla, suenan el audio y empieza el giro juntos.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          soundFX.startOpeningSample().catch(() => {
            synthTicks = true;
          });
          setSpinning(true);
          setOffset(targetOffset);
        });
      });

      // El tick sale de la posición que el navegador está pintando de verdad. Antes se
      // reimplementaba la bezier en JS para estimarla, con puntos de control que ni
      // siquiera coincidían con los del CSS y sin invertir x para despejar t, así que los
      // clicks sonaban donde no había ningún objeto cruzando el marcador.
      const cell = CELL_WIDTH + CELL_GAP;
      const readTick = () => {
        const track = trackRef.current;
        if (track && synthTicks) {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
          const currentCell = Math.floor((-matrix.m41 + viewportWidth / 2) / cell);
          if (lastCellRef.current !== null && currentCell !== lastCellRef.current) soundFX.playReelTick();
          lastCellRef.current = currentCell;
        }
        frameRef.current = requestAnimationFrame(readTick);
      };
      frameRef.current = requestAnimationFrame(readTick);

      timerRef.current = setTimeout(() => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        setLanded(true);
        doneRef.current();
      }, SPIN_DURATION_MS + 120);
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      soundFX.stopOpeningSample();
    };
    // Una apertura monta el carrete una sola vez: repetir el efecto reiniciaría el giro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="reel-viewport"
      ref={viewportRef}
      style={{ ['--reel-cell-w' as string]: `${CELL_WIDTH}px`, ['--reel-cell-gap' as string]: `${CELL_GAP}px` }}
    >
      {preparing ? (
        <div className="reel-prepare">
          {chestImage ? <img src={chestImage} alt="" /> : <span className="reel-prepare-fallback" />}
        </div>
      ) : (
        <>
          <div className="reel-marker" />
          <div
            className="reel-track"
            ref={trackRef}
            style={{
              transform: `translateX(-${offset}px)`,
              transition: spinning ? `transform ${SPIN_DURATION_MS}ms ${SPIN_EASING}` : 'none',
            }}
          >
            {items.map((item, i) => {
              const isLegendary = item.rarity === 'legendary';
              return (
                <div
                  key={i}
                  className={`reel-item${landed && i === WINNER_INDEX ? ' is-winner' : ''}`}
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
