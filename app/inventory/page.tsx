'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import {
  IconChest,
  IconDashboard,
  IconGift,
  IconLedger,
  IconSparkles,
  IconUpgrade,
} from '@/components/Icons';
import MobileNav from '@/components/MobileNav';
import SkinDetailModal, { type SkinDetailItem } from '@/components/SkinDetailModal';
import TradeUpModal from '@/components/TradeUpModal';
import { getCs2Grade } from '@/lib/cs2-grade';
import { soundFX } from '@/lib/sound';
import { formatXp, XP_SCALE } from '@/lib/xp';

interface InventoryItem {
  id: string;
  name: string;
  rarity: string | null;
  rarity_color?: string | null;
  chest_id?: string | null;
  image: string | null;
  count: number;
  first_at: string;
  last_at: string;
  priceUsd: number | null;
  priceWear: string | null;
  priceStale: boolean;
  priceIsFallback?: boolean;
}

import { filterAndSortInventory } from '@/lib/inventory-filter';

const RARITY_OPTIONS = [
  { id: 'all', label: 'Todas' },
  { id: 'legendary', label: 'Legendaria' },
  { id: 'epic', label: 'Épica' },
  { id: 'rare', label: 'Rara' },
  { id: 'common', label: 'Común' },
];

const SORT_OPTIONS = [
  { id: 'price-desc', label: 'Mayor valor ($)' },
  { id: 'price-asc', label: 'Menor valor ($)' },
  { id: 'newest', label: 'Más recientes' },
  { id: 'oldest', label: 'Más antiguos' },
  { id: 'name', label: 'Nombre A-Z' },
];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalUsd, setTotalUsd] = useState(0);
  const [pendingPrices, setPendingPrices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState(false);
  const [selling, setSelling] = useState<string | null>(null);
  const [sellRate, setSellRate] = useState(1.0);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('price-desc');
  const [dropStats, setDropStats] = useState<any>(null);

  // Modals
  const [inspectingItem, setInspectingItem] = useState<SkinDetailItem | null>(null);
  const [showTradeUpModal, setShowTradeUpModal] = useState(false);

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
      if (data.dropStats) setDropStats(data.dropStats);
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
        soundFX.playError();
        setError(data?.error ?? 'No se pudo vender.');
        return;
      }
      soundFX.playSale();
      if (inspectingItem?.id === item.id) {
        setInspectingItem(null);
      }
      const credited =
        data?.xpCredited ?? Math.max(1, Math.round((item.priceUsd ?? 0) * XP_SCALE * sellRate));
      setSuccessMessage(
        `¡Venta completada! +${formatXp(credited)} XP ($${(credited / 100).toFixed(2)} USD) acreditados a tu saldo.`
      );
      await load();
    } catch {
      soundFX.playError();
      setError('No se pudo vender.');
    } finally {
      setSelling(null);
    }
  }

  async function refreshPrices() {
    soundFX.playClick();
    setPricing(true);
    setError('');
    try {
      const res = await fetch('/api/inventory/prices', { method: 'POST' });
      if (!res.ok) throw new Error('price request failed');
      await load();
    } catch {
      setError(
        'No se pudieron actualizar los precios. Steam limita las consultas, probá de nuevo en un rato.'
      );
    } finally {
      setPricing(false);
    }
  }

  const filteredItems = useMemo(() => {
    return filterAndSortInventory(items, {
      search,
      rarity: rarityFilter,
      sortBy: (sortBy === 'newest' ? 'recent' : sortBy === 'name' ? 'name-asc' : sortBy) as any,
    });
  }, [items, search, rarityFilter, sortBy]);

  const legendaryCount = useMemo(() => {
    return items.filter((i) => i.rarity === 'legendary').reduce((acc, curr) => acc + curr.count, 0);
  }, [items]);

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

        {successMessage && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.6rem 0.9rem',
              fontSize: '0.85rem',
              color: 'var(--accent-primary)',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '4px',
              fontWeight: 600,
            }}
          >
            {successMessage}
          </div>
        )}

        <Header>
          <a href="/" className="nav-link nav-page" onClick={() => soundFX.playClick()}>
            <IconDashboard size={16} /> Dashboard
          </a>
          <a href="/rewards" className="nav-link nav-page" onClick={() => soundFX.playClick()}>
            <IconGift size={16} /> Recompensas
          </a>
          <button className="nav-link nav-page active" aria-label="Inventario">
            <IconChest size={16} /> Inventario
          </button>
          <a href="/upgrade" className="nav-link nav-page" onClick={() => soundFX.playClick()}>
            <IconUpgrade size={16} /> Upgrade
          </a>
          <a href="/ledger" className="nav-link nav-page" onClick={() => soundFX.playClick()}>
            <IconLedger size={16} /> Estado de cuenta
          </a>
        </Header>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Inventario</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
              Todo lo que salió de tus cofres de CS2.
            </p>
          </div>
          <button
            className="btn-action"
            onClick={() => {
              soundFX.playClick();
              setShowTradeUpModal(true);
            }}
            style={{
              background: 'var(--accent-xp)',
              color: '#000',
              borderColor: 'var(--accent-xp)',
              fontWeight: 700,
            }}
          >
            <IconSparkles size={16} /> Contrato Trade-Up
          </button>
        </div>

        {/* Stats & Filters Bar */}
        <div
          className="ledger-meta"
          style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}
        >
          <span>
            {items.length} distintos &middot; {totalItems} total
            {legendaryCount > 0 && ` · ${legendaryCount} legendarios`}
          </span>
          {totalUsd > 0 && (
            <span className="mono-value" style={{ fontSize: '0.9rem', color: 'var(--accent-xp)' }}>
              ${totalUsd.toFixed(2)} USD ref
            </span>
          )}

          {dropStats && dropStats.totalOpened > 0 && (
            <span
              title={`Aperturas: ${dropStats.totalOpened} cajas | Raras+: ${dropStats.luckScorePercent}% (Base ~20%) | Comunes: ${dropStats.rarityCounts.common}, Raras: ${dropStats.rarityCounts.rare}, Épicas: ${dropStats.rarityCounts.epic}, Legendarias: ${dropStats.rarityCounts.legendary}`}
              style={{
                fontSize: '0.78rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                background:
                  dropStats.luckRating === 'lucky'
                    ? 'rgba(34, 197, 94, 0.15)'
                    : dropStats.luckRating === 'unlucky'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'var(--bg-card)',
                color:
                  dropStats.luckRating === 'lucky'
                    ? 'var(--accent-primary)'
                    : dropStats.luckRating === 'unlucky'
                      ? 'var(--error, #ef4444)'
                      : 'var(--text-muted)',
                border: '1px solid var(--border)',
                cursor: 'default',
                fontWeight: 600,
              }}
            >
              Suerte:{' '}
              {dropStats.luckRating === 'lucky'
                ? 'Alta'
                : dropStats.luckRating === 'unlucky'
                  ? 'Baja'
                  : 'Promedio'}{' '}
              ({dropStats.luckScorePercent}%)
            </span>
          )}

          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginLeft: 'auto',
            }}
          >
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              {RARITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    soundFX.playClick();
                    setRarityFilter(opt.id);
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '3px',
                    border: `1px solid ${rarityFilter === opt.id ? 'var(--accent-primary)' : 'var(--border)'}`,
                    background: rarityFilter === opt.id ? 'var(--accent-primary)' : 'transparent',
                    color: rarityFilter === opt.id ? 'var(--bg)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: rarityFilter === opt.id ? 700 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Ordenar inventario"
              style={{
                fontSize: '0.8rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '3px',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
              }}
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Buscar skin..."
              aria-label="Buscar skin"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: '160px', padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}
            />
          </div>
        </div>

        {items.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              margin: '0.75rem 0 0.5rem',
            }}
          >
            <button className="btn-action" onClick={refreshPrices} disabled={pricing}>
              {pricing ? 'Consultando a Steam...' : 'Actualizar precios'}
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {pendingPrices > 0 ? `${pendingPrices} sin cotizar` : 'Precios al día'}
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
        ) : filteredItems.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '2rem 0', textAlign: 'center' }}>
            {search || rarityFilter !== 'all'
              ? 'No se encontraron objetos con los filtros actuales.'
              : 'Todavía no abriste ningún cofre. Lo que saques va a aparecer acá.'}
          </p>
        ) : (
          <div className="inventory-grid">
            {filteredItems.map((item) => {
              const grade = getCs2Grade(item);

              return (
                <article
                  key={item.id}
                  className="inventory-card"
                  style={{
                    ['--cell-rarity' as string]: grade.hex,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    soundFX.playClick();
                    setInspectingItem(item);
                  }}
                >
                  <div className="inventory-art">
                    {item.image ? (
                      <img src={item.image} alt="" loading="lazy" />
                    ) : (
                      <span className="reel-item-blank" />
                    )}
                    {item.count > 1 && <span className="inventory-count">&times;{item.count}</span>}
                  </div>
                  <button
                    type="button"
                    className="inventory-name"
                    style={{
                      background: 'none',
                      border: 0,
                      padding: 0,
                      color: 'inherit',
                      font: 'inherit',
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                    }}
                    title="Ver detalle"
                  >
                    {item.name}
                  </button>
                  <span className="inventory-rarity" style={{ color: grade.hex }}>
                    {grade.nameEs}
                  </span>
                  {item.priceUsd !== null && (
                    <>
                      <span
                        className="inventory-price"
                        title={
                          item.priceIsFallback
                            ? 'Precio base de referencia (por categoría de rareza)'
                            : item.priceWear
                              ? `Precio de referencia Steam (${item.priceWear})`
                              : 'Precio de referencia Steam'
                        }
                      >
                        ${item.priceUsd.toFixed(2)}
                        {item.count > 1 && <em> c/u</em>}
                      </span>
                      <button
                        type="button"
                        className="btn-action"
                        style={{ marginTop: '0.35rem', width: '100%' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          sell(item);
                        }}
                        disabled={selling !== null}
                      >
                        {selling === item.id
                          ? 'Vendiendo...'
                          : `Vender por ${formatXp(Math.max(1, Math.round(item.priceUsd * XP_SCALE * sellRate)))} XP`}
                      </button>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      <SkinDetailModal
        item={inspectingItem}
        sellRate={sellRate}
        onClose={() => setInspectingItem(null)}
        onSell={sell}
        selling={selling !== null}
      />

      <TradeUpModal
        isOpen={showTradeUpModal}
        onClose={() => setShowTradeUpModal(false)}
        onSuccess={load}
        inventory={items}
      />

      <MobileNav activeTab="inventory" />
    </div>
  );
}
