'use client';

import React, { useMemo } from 'react';
import type { BatchWonItem } from '@/lib/batch-open';
import { getCs2Grade, type Cs2GradeInfo } from '@/lib/cs2-grade';
import { formatXp } from '@/lib/xp';
import { IconClose } from './Icons';
import Modal from './Modal';
import SkinGradeBadge from './SkinGradeBadge';

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
  const gradeCounts = useMemo(() => {
    if (!items || items.length === 0) return [];
    const map = new Map<string, { grade: Cs2GradeInfo; count: number }>();
    for (const item of items) {
      const grade = getCs2Grade(item);
      const existing = map.get(grade.id) ?? { grade, count: 0 };
      existing.count += 1;
      map.set(grade.id, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.grade.rank - a.grade.rank);
  }, [items]);

  if (!isOpen || items.length === 0) return null;

  return (
    <Modal onClose={onClose}>
      <div
        className="modal-dialog"
        style={{
          maxWidth: 'min(780px, 94vw)',
          width: '100%',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: 'clamp(1rem, 3vw, 1.5rem)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.45rem)', margin: 0, fontWeight: 800 }}>
              Apertura en Lote: {chestName} ({items.length}x)
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              XP invertido: <strong style={{ color: 'var(--accent-xp)' }}>{formatXp(totalXpSpent)} XP</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.3rem',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Cerrar modal de apertura en lote"
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* CS2 Grade Breakdown Pills */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.25rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
          aria-label="Resumen por grado de CS2"
        >
          {gradeCounts.map(({ grade, count }) => (
            <div
              key={grade.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <SkinGradeBadge grade={grade} size="xs" showDot />
              <span
                style={{
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}
              >
                &times;{count}
              </span>
            </div>
          ))}
        </div>

        {/* Drops Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(115px, 28vw, 135px), 1fr))',
            gap: '0.75rem',
            maxHeight: '380px',
            overflowY: 'auto',
            paddingRight: '0.25rem',
            marginBottom: '1.25rem',
          }}
        >
          {items.map((item, idx) => {
            const grade = getCs2Grade(item);

            return (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderBottom: `3px solid ${grade.hex}`,
                  borderRadius: '6px',
                  padding: '0.65rem 0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '0.3rem',
                  boxShadow:
                    grade.id === 'extraordinary'
                      ? '0 0 14px rgba(255, 215, 0, 0.25)'
                      : '0 2px 6px rgba(0, 0, 0, 0.3)',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '65px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{
                        maxHeight: '58px',
                        maxWidth: '100%',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))',
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <span className="reel-item-blank" style={{ width: '80px', height: '50px' }} />
                  )}
                </div>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                  title={item.name}
                >
                  {item.name}
                </span>
                <SkinGradeBadge grade={grade} size="xs" variant="text" />
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn"
            style={{ padding: '0.65rem 1.6rem', minHeight: '44px', fontWeight: 700 }}
            onClick={onClose}
          >
            Guardar en Inventario
          </button>
        </div>
      </div>
    </Modal>
  );
}
