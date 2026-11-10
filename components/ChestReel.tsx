'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildReel,
  CELL_GAP,
  CELL_WIDTH,
  COMPACT_CELL_WIDTH,
  COMPACT_VIEWPORT_PX,
  type ReelChestItem,
  type ReelResult,
  reelCellColor,
  reelTickTimes,
  SPIN_EASING,
  WINNER_INDEX,
} from '@/lib/chest-reel';
import { useChestReelSequence } from '@/lib/chest-reel-sequence';
import type { Rarity } from '@/lib/rewards';

const SPIN_DURATION_DEFAULT_MS = 6500;

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
  const [reel, setReel] = useState<ReelResult | null>(null);
  const [cellWidth, setCellWidth] = useState(CELL_WIDTH);

  // La tira se construye una sola vez en el montaje con el ancho real del viewport medido en el DOM
  useEffect(() => {
    const viewportWidth = viewportRef.current?.clientWidth ?? 700;
    const cw = window.matchMedia(`(max-width: ${COMPACT_VIEWPORT_PX}px)`).matches
      ? COMPACT_CELL_WIDTH
      : CELL_WIDTH;
    setCellWidth(cw);
    setReel(buildReel(pool, winnerId, cw, viewportWidth));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const imageUrls = useMemo(
    () =>
      reel
        ? Array.from(new Set(reel.items.map((i) => i.image).filter((u): u is string => !!u)))
        : [],
    [reel]
  );

  const winnerRarity = (reel?.items[WINNER_INDEX]?.rarity ?? 'common') as Rarity;

  const { preparing, spinning, landed } = useChestReelSequence({
    ready: Boolean(reel),
    imageUrls,
    spinDurationMs,
    skip,
    winnerRarity,
    getTickTimes: () => (reel ? reelTickTimes(spinDurationMs, reel) : []),
    onDone,
  });

  const offset = spinning || landed ? (reel?.targetOffset ?? 0) : 0;

  return (
    <div
      className="reel-viewport"
      ref={viewportRef}
      style={{
        ['--reel-cell-w' as string]: `${cellWidth}px`,
        ['--reel-cell-gap' as string]: `${CELL_GAP}px`,
      }}
    >
      {preparing || !reel ? (
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
            aria-hidden="true"
            style={{
              transform: `translateX(-${offset}px)`,
              transition: spinning ? `transform ${spinDurationMs}ms ${SPIN_EASING}` : 'none',
            }}
          >
            {reel.items.map((item, i) => {
              const isLegendary = item.rarity === 'legendary';
              return (
                <div
                  key={i}
                  className={`reel-item${landed && i === WINNER_INDEX ? ' is-winner' : ''}${
                    landed && i === WINNER_INDEX && isLegendary ? ' is-legendary-winner' : ''
                  }`}
                  style={{ ['--cell-rarity' as string]: reelCellColor(item) }}
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
