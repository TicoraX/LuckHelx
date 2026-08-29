'use client';

import React from 'react';
import { IconClose } from './Icons';
import { formatXp } from '@/lib/xp';
import type { BatchWonItem } from '@/lib/batch-open';

interface BatchOpeningModalProps {
  isOpen: boolean;
  chestName: string;
  items: BatchWonItem[];
  totalXpSpent: number;
  onClose: () => void;
}

export default function BatchOpeningModal({
  isOpen,
  chestName,
  items,
  totalXpSpent,
  onClose,
}: BatchOpeningModalProps) {
  if (!isOpen || items.length === 0) return null;

  const legendaryCount = items.filter((i) => i.rarity === 'legendary').length;
  const epicCount = items.filter((i) => i.rarity === 'epic').length;
  const rareCount = items.filter((i) => i.rarity === 'rare').length;
  const commonCount = items.filter((i) => i.rarity === 'common').length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '750px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>
              Apertura en Lote: {chestName} ({items.length}x)
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
              XP invertido: {formatXp(totalXpSpent)} XP
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.2rem',
            }}
            aria-label="Cerrar modal de apertura en lote"
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Rarity breakdown pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {legendaryCount > 0 && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '3px',
                background: 'var(--rarity-legendary)',
                color: '#000',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
              }}
            >
              ★ {legendaryCount} Legendarios
            </span>
          )}
          {epicCount > 0 && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '3px',
                background: 'var(--rarity-epic)',
                color: '#fff',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {epicCount} Épicos
            </span>
          )}
          {rareCount > 0 && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '3px',
                background: 'var(--rarity-rare)',
                color: '#fff',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {rareCount} Raros
            </span>
          )}
          {commonCount > 0 && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '3px',
                background: 'var(--rarity-common)',
                color: '#fff',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {commonCount} Comunes
            </span>
          )}
        </div>

        {/* Drops Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '0.75rem',
            maxHeight: '360px',
            overflowY: 'auto',
            paddingRight: '0.25rem',
            marginBottom: '1.25rem',
          }}
        >
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderBottom: `3px solid var(--rarity-${item.rarity ?? 'common'})`,
                borderRadius: '4px',
                padding: '0.6rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '0.25rem',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '70px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span className="reel-item-blank" style={{ width: '80px', height: '55px' }} />
                )}
              </div>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
                title={item.name}
              >
                {item.name}
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                  color: `var(--rarity-${item.rarity ?? 'common'})`,
                  fontWeight: 700,
                }}
              >
                {item.rarity}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn" style={{ padding: '0.6rem 1.5rem' }} onClick={onClose}>
            Guardar en Inventario
          </button>
        </div>
      </div>
    </div>
  );
}
