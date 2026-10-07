'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { IconClose, IconBook } from './Icons';
import type { ChestCollectionInfo } from '@/lib/collections';

interface CollectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CollectionsModal({ isOpen, onClose }: CollectionsModalProps) {
  const [collections, setCollections] = useState<ChestCollectionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    setLoading(true);

    fetch('/api/collections', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.collections)) {
          setCollections(data.collections);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          // ignore non-abort error
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconBook size={20} color="var(--accent-primary)" /> Álbum de Colecciones CS2
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
              Rastrea el progreso de skins conseguidas para cada caja del catálogo.
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
            aria-label="Cerrar álbum de colecciones"
          >
            <IconClose size={20} />
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Cargando álbum...</p>
        ) : collections.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>No hay colecciones registradas.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '0.85rem',
              maxHeight: '450px',
              overflowY: 'auto',
              paddingRight: '0.25rem',
            }}
          >
            {collections.map((col) => (
              <div
                key={col.chestId}
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${col.isCompleted ? 'var(--accent-primary)' : 'var(--border)'}`,
                  borderRadius: '6px',
                  padding: '0.9rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{col.chestName}</span>
                  {col.isCompleted ? (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '3px',
                        background: 'var(--accent-primary)',
                        color: '#000',
                        fontWeight: 700,
                      }}
                    >
                      ★ Completo
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {col.collectedItems} / {col.totalItems}
                    </span>
                  )}
                </div>

                <div className="xp-progress-bar" style={{ height: '6px' }}>
                  <div
                    className="xp-progress-fill"
                    style={{
                      width: `${col.percentComplete}%`,
                      background: col.isCompleted ? 'var(--accent-primary)' : 'var(--accent-xp)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span>Progreso de colección</span>
                  <span style={{ fontWeight: 600, color: col.isCompleted ? 'var(--accent-primary)' : 'var(--text-main)' }}>
                    {col.percentComplete}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
