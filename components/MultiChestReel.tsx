'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildReel,
  CELL_GAP,
  COMPACT_CELL_WIDTH,
  COMPACT_VIEWPORT_PX,
  highestRarity,
  type ReelChestItem,
  reelCellColor,
  reelTickTimes,
  SPIN_EASING,
  WINNER_INDEX,
} from '@/lib/chest-reel';
import { useChestReelSequence } from '@/lib/chest-reel-sequence';
import Modal from './Modal';

const MULTI_CELL_WIDTH = 150;
const SPIN_DURATION_DEFAULT_MS = 6500;
const HOLD_MS = 1400;

/**
 * N carretes apilados que giran a la vez y frenan juntos (#15).
 * Usa el hook compartido `useChestReelSequence`.
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
  /** Saltear (botón o Escape). */
  onSkip: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const [cellWidth, setCellWidth] = useState(() => {
    if (typeof window === 'undefined') return MULTI_CELL_WIDTH;
    return window.matchMedia(`(max-width: ${COMPACT_VIEWPORT_PX}px)`).matches
      ? COMPACT_CELL_WIDTH
      : MULTI_CELL_WIDTH;
  });

  const strips = useMemo(() => {
    const viewportWidth =
      typeof window === 'undefined' ? 700 : viewportRef.current?.clientWidth || 700;
    return winnerIds.map((id) => buildReel(pool, id, cellWidth, viewportWidth));
  }, [pool, winnerIds, cellWidth]);

  useEffect(() => {
    const cw = window.matchMedia(`(max-width: ${COMPACT_VIEWPORT_PX}px)`).matches
      ? COMPACT_CELL_WIDTH
      : MULTI_CELL_WIDTH;
    if (cw !== cellWidth) setCellWidth(cw);
  }, [cellWidth]);

  const imageUrls = useMemo(
    () =>
      Array.from(
        new Set(strips.flatMap((s) => s.items.map((i) => i.image)).filter((u): u is string => !!u))
      ),
    [strips]
  );

  const winnerRarities = useMemo(
    () => strips.map((s) => s.items[WINNER_INDEX]?.rarity ?? 'common'),
    [strips]
  );
  const bestRarity = highestRarity(winnerRarities);

  const { preparing, spinning, landed } = useChestReelSequence({
    imageUrls,
    spinDurationMs,
    winnerRarity: bestRarity,
    getTickTimes: () => (strips[0] ? reelTickTimes(spinDurationMs, strips[0]) : []),
    holdMs: HOLD_MS,
    onLanded,
    onDone,
  });

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
                      transform: `translateX(-${spinning || landed ? strips[k].targetOffset : 0}px)`,
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
                          className={`reel-item multi-reel-item${isWinner ? ' is-winner' : ''}${
                            isWinner && isLegendary ? ' is-legendary-winner' : ''
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
