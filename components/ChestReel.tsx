'use client';

import { useEffect, useRef, useState } from 'react';
import { buildReel, ReelChestItem } from '@/lib/chest-reel';

const ITEM_WIDTH = 120;
const SPIN_DURATION_MS = 4500;

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

  useEffect(() => {
    const containerWidth = viewportRef.current?.clientWidth ?? 600;
    const { items: reelItems, targetOffset } = buildReel(pool, winnerId, ITEM_WIDTH, containerWidth);
    setItems(reelItems);

    requestAnimationFrame(() => {
      setSpinning(true);
      setOffset(targetOffset);
    });

    const timeout = setTimeout(onDone, SPIN_DURATION_MS);
    return () => clearTimeout(timeout);
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
                boxShadow: item.rarityColor ? `0 0 10px ${item.rarityColor}55` : undefined,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.4rem',
              }}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  style={{
                    width: '64px',
                    height: '48px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                  }}
                />
              ) : (
                <span style={{ fontSize: '1.2rem' }}>
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
                  marginTop: '0.2rem',
                }}
                title={item.name}
              >
                {item.name}
              </span>

              <span
                className={`rarity-badge rarity-${item.rarity}`}
                style={{
                  backgroundColor: item.rarityColor ? `${item.rarityColor}22` : undefined,
                  color: item.rarityColor ? item.rarityColor : undefined,
                  borderColor: item.rarityColor ? item.rarityColor : undefined,
                }}
              >
                {item.rarity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
