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
        {items.map((item, i) => (
          <div
            key={i}
            className="reel-item"
            style={{
              borderColor:
                item.rarity === 'epic'
                  ? 'var(--rarity-epic)'
                  : item.rarity === 'rare'
                  ? 'var(--rarity-rare)'
                  : 'var(--border)',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>
              {item.rarity === 'epic' ? '🔮' : item.rarity === 'rare' ? '💎' : '🎁'}
            </span>
            <span style={{ fontWeight: 600, fontSize: '0.82rem', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </span>
            <span className={`rarity-badge rarity-${item.rarity}`}>{item.rarity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
