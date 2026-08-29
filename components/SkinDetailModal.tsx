'use client';

import React from 'react';
import { IconClose } from './Icons';
import { XP_SCALE, formatXp } from '@/lib/xp';

export interface SkinDetailItem {
  id: string;
  name: string;
  rarity: string | null;
  image: string | null;
  count: number;
  first_at: string;
  last_at: string;
  priceUsd: number | null;
  priceWear: string | null;
  priceStale: boolean;
}

interface SkinDetailModalProps {
  item: SkinDetailItem | null;
  sellRate: number;
  onClose: () => void;
  onSell: (item: SkinDetailItem) => void;
  selling: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function SkinDetailModal({
  item,
  sellRate,
  onClose,
  onSell,
  selling,
}: SkinDetailModalProps) {
  if (!item) return null;

  const steamMarketUrl = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(item.name)}`;
  const sellXpValue = item.priceUsd !== null
    ? Math.max(1, Math.round(item.priceUsd * XP_SCALE * sellRate))
    : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          borderTop: `4px solid var(--rarity-${item.rarity ?? 'common'})`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <span
              style={{
                display: 'inline-block',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
                color: `var(--rarity-${item.rarity ?? 'common'})`,
                fontWeight: 700,
                letterSpacing: '0.05em',
                marginBottom: '0.25rem',
              }}
            >
              {item.rarity ?? 'Común'}
            </span>
            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>{item.name}</h2>
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
            aria-label="Cerrar modal de inspección"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div
          style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '1.5rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '1.25rem',
            minHeight: '180px',
          }}
        >
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              style={{ maxHeight: '160px', maxWidth: '100%', objectFit: 'contain', filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.4))' }}
            />
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Sin imagen</span>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Cantidad</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '0.2rem' }}>&times;{item.count}</div>
          </div>
          <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Desgaste Steam</div>
            <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{item.priceWear ?? 'Estándar'}</div>
          </div>
          <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Precio Referencia</div>
            <div style={{ fontWeight: 700, color: 'var(--accent-xp)', fontSize: '1rem', marginTop: '0.2rem' }}>
              {item.priceUsd !== null ? (
                <>
                  ${item.priceUsd.toFixed(2)}
                  {item.priceStale && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem', fontWeight: 'normal' }}>
                      (obsoleto)
                    </span>
                  )}
                </>
              ) : (
                'Sin cotizar'
              )}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          <div>Obtenido por primera vez: {formatDate(item.first_at)}</div>
          {item.count > 1 && <div>Última copia obtenida: {formatDate(item.last_at)}</div>}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {sellXpValue !== null && (
            <button
              className="btn-action"
              style={{ flex: 1, minWidth: '160px', padding: '0.6rem' }}
              onClick={() => onSell(item)}
              disabled={selling}
            >
              {selling ? 'Vendiendo...' : `Vender 1x por ${formatXp(sellXpValue)} XP`}
            </button>
          )}
          <a
            href={steamMarketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-action"
            style={{
              flex: 1,
              minWidth: '160px',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--border)',
              color: 'var(--text-main)',
              border: '1px solid var(--border)',
            }}
          >
            Ver en Steam Market ↗
          </a>
        </div>
      </div>
    </div>
  );
}
