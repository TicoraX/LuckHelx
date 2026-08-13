'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import { soundFX } from '@/lib/sound';
import { IconDashboard, IconGift, IconLedger, IconChest } from '@/components/Icons';

interface InventoryItem {
  id: string;
  name: string;
  rarity: string | null;
  image: string | null;
  count: number;
  first_at: string;
  last_at: string;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short' }).replace('.', '');
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/inventory');
      if (!res.ok) throw new Error('inventory request failed');
      const data = await res.json();
      setItems(data.items ?? []);
      setTotalItems(data.totalItems ?? 0);
    } catch {
      setError('No se pudo cargar tu inventario. Reintentá más tarde.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="fade-in">
      <main className="container">
        {error && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.6rem 0.9rem',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
            }}
          >
            {error}
          </div>
        )}

        <Header>
          <a href="/" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconDashboard size={16} /> Dashboard
          </a>
          <a href="/rewards" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconGift size={16} /> Recompensas
          </a>
          <button className="nav-link active" aria-label="Inventario">
            <IconChest size={16} /> Inventario
          </button>
          <a href="/ledger" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconLedger size={16} /> Estado de cuenta
          </a>
        </Header>

        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Inventario</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
            Todo lo que salió de tus cofres.
          </p>
        </div>

        <div className="ledger-meta">
          <span>
            {items.length} {items.length === 1 ? 'objeto distinto' : 'objetos distintos'} &middot;{' '}
            {totalItems} en total
          </span>
        </div>

        {loading ? (
          <div className="inventory-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="inventory-card" style={{ opacity: 0.35 }}>
                <div className="inventory-art" />
                <span className="inventory-name">&mdash;</span>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '2rem 0', textAlign: 'center' }}>
            Todavía no abriste ningún cofre. Lo que saques va a aparecer acá.
          </p>
        ) : (
          <div className="inventory-grid">
            {items.map((item) => (
              <article
                key={item.id}
                className="inventory-card"
                style={{ ['--cell-rarity' as string]: `var(--rarity-${item.rarity ?? 'common'})` }}
                title={`Primero el ${formatShortDate(item.first_at)}, último el ${formatShortDate(item.last_at)}`}
              >
                <div className="inventory-art">
                  {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="reel-item-blank" />}
                  {item.count > 1 && <span className="inventory-count">&times;{item.count}</span>}
                </div>
                <span className="inventory-name">{item.name}</span>
                <span className="inventory-rarity">{item.rarity}</span>
              </article>
            ))}
          </div>
        )}
      </main>

      <MobileNav activeTab="inventory" />
    </div>
  );
}
