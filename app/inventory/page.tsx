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
  priceUsd: number | null;
  priceWear: string | null;
  priceStale: boolean;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short' }).replace('.', '');
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalUsd, setTotalUsd] = useState(0);
  const [pendingPrices, setPendingPrices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState(false);
  const [selling, setSelling] = useState<string | null>(null);
  const [sellRate, setSellRate] = useState(0.4);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/inventory');
      if (!res.ok) throw new Error('inventory request failed');
      const data = await res.json();
      setItems(data.items ?? []);
      setTotalItems(data.totalItems ?? 0);
      setTotalUsd(data.totalUsd ?? 0);
      setPendingPrices(data.pendingPrices ?? 0);
    } catch {
      setError('No se pudo cargar tu inventario. Reintentá más tarde.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.saleEconomy) setSellRate(data.saleEconomy.sellRate);
      })
      .catch(() => {});
  }, []);

  async function sell(item: InventoryItem) {
    if (selling) return;
    soundFX.playClick();
    setSelling(item.id);
    setError('');
    try {
      const res = await fetch('/api/inventory/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) {
        setError(data?.error ?? 'No se pudo vender.');
        return;
      }
      soundFX.playTaskComplete();
      await load();
    } catch {
      setError('No se pudo vender.');
    } finally {
      setSelling(null);
    }
  }

  // Explicito a proposito: cada refresco le pega a Steam, que limita las consultas. El
  // techo por llamada esta en la ruta; si quedan pendientes, se aprieta de nuevo.
  async function refreshPrices() {
    soundFX.playClick();
    setPricing(true);
    setError('');
    try {
      const res = await fetch('/api/inventory/prices', { method: 'POST' });
      if (!res.ok) throw new Error('price request failed');
      await load();
    } catch {
      setError('No se pudieron actualizar los precios. Steam limita las consultas, probá de nuevo en un rato.');
    } finally {
      setPricing(false);
    }
  }

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
          {totalUsd > 0 && (
            <span className="mono-value" style={{ fontSize: '0.9rem', color: 'var(--accent-xp)' }}>
              ${totalUsd.toFixed(2)} de referencia
            </span>
          )}
        </div>

        {items.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0 0.25rem' }}>
            <button className="btn-action" onClick={refreshPrices} disabled={pricing}>
              {pricing ? 'Consultando a Steam...' : 'Actualizar precios'}
            </button>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
              {pendingPrices > 0
                ? `${pendingPrices} sin cotizar`
                : 'Precios al dia'}
            </span>
          </div>
        )}

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
                {item.priceUsd !== null && (
                  <>
                    <span
                      className="inventory-price"
                      title={item.priceWear ? `Precio de referencia (${item.priceWear})` : 'Precio de referencia'}
                    >
                      ${item.priceUsd.toFixed(2)}
                      {item.count > 1 && <em> c/u</em>}
                    </span>
                    <button
                      className="btn-action"
                      style={{ marginTop: '0.35rem', width: '100%' }}
                      onClick={() => sell(item)}
                      disabled={selling !== null}
                    >
                      {selling === item.id
                        ? 'Vendiendo...'
                        : `Vender por ${Math.max(1, Math.round(item.priceUsd * sellRate))} XP`}
                    </button>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </main>

      <MobileNav activeTab="inventory" />
    </div>
  );
}
