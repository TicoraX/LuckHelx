'use client';

import { useEffect, useRef, useState } from 'react';
import { buildReel, ReelChestItem } from '@/lib/chest-reel';
import { soundFX } from '@/lib/sound';

const ITEM_WIDTH = 130;
const ITEM_GAP = 10;
const SPIN_DURATION_MS = 5500; // 5.5 seconds for authentic CS:GO spin duration

// Cubic Bezier curve matching CS:GO spin easing (starts fast, long deceleration)
function solveCubicBezier(t: number): number {
  const p1y = 0.82;
  const p2y = 1.0;
  const u = 1 - t;
  return 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t;
}

export default function ChestReel({
  pool,
  winnerId,
  onDone,
}: {
  pool: ReelChestItem[];
  winnerId: string;
  onDone: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<ReelChestItem[]>([]);
  const [spinning, setSpinning] = useState(false);

  const lastItemIndexRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const containerWidth = viewportRef.current?.clientWidth ?? 700;
    const { items: reelItems, targetOffset } = buildReel(pool, winnerId, ITEM_WIDTH, containerWidth);
    setItems(reelItems);

    const cellWidth = ITEM_WIDTH + ITEM_GAP;

    // Start spin animation frame for tick sound sync
    const startTime = performance.now();

    requestAnimationFrame(() => {
      setSpinning(true);
      setOffset(targetOffset);
    });

    const tickCheck = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / SPIN_DURATION_MS);
      const easedProgress = solveCubicBezier(progress);
      const currentOffset = targetOffset * easedProgress;

      const currentItemIndex = Math.floor((currentOffset + containerWidth / 2) / cellWidth);

      if (lastItemIndexRef.current !== null && currentItemIndex !== lastItemIndexRef.current) {
        soundFX.playReelTick();
      }
      lastItemIndexRef.current = currentItemIndex;

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tickCheck);
      }
    };

    animFrameRef.current = requestAnimationFrame(tickCheck);

    const timeout = setTimeout(() => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      onDone();
    }, SPIN_DURATION_MS + 200);

    return () => {
      clearTimeout(timeout);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="reel-viewport" ref={viewportRef}>
      <div className="reel-marker" />
      <div
        className="reel-track"
        style={{
          transform: `translateX(-${offset}px)`,
          transition: spinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.8, 0.18, 1)` : 'none',
        }}
      >
        {items.map((item, i) => {
          const borderColor = item.rarityColor
            ? item.rarityColor
            : item.rarity === 'epic'
            ? 'var(--rarity-epic)'
            : item.rarity === 'rare'
            ? 'var(--rarity-rare)'
            : 'var(--border)';

          return (
            <div
              key={i}
              className="reel-item"
              style={{
                borderColor,
                boxShadow: item.rarityColor ? `0 0 12px ${item.rarityColor}55` : undefined,
                background: 'rgba(18, 19, 24, 0.95)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.4rem',
                position: 'relative',
              }}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  style={{
                    width: '76px',
                    height: '56px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.6))',
                  }}
                />
              ) : (
                <span style={{ fontSize: '1.4rem' }}>
                  {item.rarity === 'epic' ? '🔮' : item.rarity === 'rare' ? '💎' : '🎁'}
                </span>
              )}

              <span
                style={{
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: '0.3rem',
                  color: '#ece5d6',
                }}
                title={item.name}
              >
                {item.name}
              </span>

              {/* Rarity Bottom Stripe Bar (authentic CS:GO style) */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  backgroundColor: borderColor,
                  boxShadow: `0 0 8px ${borderColor}`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
