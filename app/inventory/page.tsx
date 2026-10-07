'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import SkinDetailModal, { type SkinDetailItem } from '@/components/SkinDetailModal';
import { soundFX } from '@/lib/sound';
import { XP_SCALE, formatXp } from '@/lib/xp';
import { IconDashboard, IconGift, IconLedger, IconChest, IconSparkles } from '@/components/Icons';

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

import { formatShortDate } from '@/lib/date';
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
  const [sellRate, setSellRate] = useState(0.4);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('price-desc');
  const [dropStats, setDropStats] = useState<any>(null);

  // Inspection Modal
  const [inspectingItem, setInspectingItem] = useState<SkinDetailItem | null>(null);

  // Trade-Up Mode
  const [tradeUpMode, setTradeUpMode] = useState(false);
  const [tradeUpRarity, setTradeUpRarity] = useState<'common' | 'rare' | 'epic'>('common');
  const [selectedTradeUpIds, setSelectedTradeUpIds] = useState<string[]>([]);
  const [submittingTradeUp, setSubmittingTradeUp] = useState(false);

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
        setError(data?.error ?? 'No se pudo vender.');
        return;
      }
      soundFX.playTaskComplete();
      if (inspectingItem?.id === item.id) {
        setInspectingItem(null);
      }
      await load();
    } catch {
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
      setError('No se pudieron actualizar los precios. Steam limita las consultas, probá de nuevo en un rato.');
    } finally {
      setPricing(false);
    }
  }

  // Trade Up selection helpers
  function toggleTradeUpSelection(item: InventoryItem) {
    if (item.rarity !== tradeUpRarity) return;
    soundFX.playClick();

    const currentlySelectedCount = selectedTradeUpIds.filter((id) => id === item.id).length;
    if (currentlySelectedCount < item.count && selectedTradeUpIds.length < 10) {
      setSelectedTradeUpIds([...selectedTradeUpIds, item.id]);
    } else if (currentlySelectedCount > 0) {
      const index = selectedTradeUpIds.lastIndexOf(item.id);
      if (index !== -1) {
        const next = [...selectedTradeUpIds];
        next.splice(index, 1);
        setSelectedTradeUpIds(next);
      }
    }
  }

  async function submitTradeUp() {
    if (selectedTradeUpIds.length !== 10 || submittingTradeUp) return;
    soundFX.playClick();
    setSubmittingTradeUp(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch('/api/inventory/trade-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputRarity: tradeUpRarity,
          itemIds: selectedTradeUpIds,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Error en el contrato de intercambio');
        return;
      }

      soundFX.playLevelUp();
      setSuccessMessage(`¡Contrato completado con éxito! Obtuviste: ${data.wonItem?.name ?? 'Nuevo Item'}`);
      setSelectedTradeUpIds([]);
      setTradeUpMode(false);
      await load();
    } catch {
      setError('Error al procesar el contrato de intercambio');
    } finally {
      setSubmittingTradeUp(false);
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
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
              setTradeUpMode(!tradeUpMode);
              setSelectedTradeUpIds([]);
            }}
            style={{
              background: tradeUpMode ? 'var(--accent-xp)' : 'var(--bg-card)',
              color: tradeUpMode ? '#000' : 'var(--text-main)',
              borderColor: 'var(--accent-xp)',
              fontWeight: 700,
            }}
          >
            <IconSparkles size={16} /> {tradeUpMode ? 'Salir de Trade-Up' : 'Contrato Trade-Up'}
          </button>
        </div>

        {/* Trade-Up Panel */}
        {tradeUpMode && (
          <div
            style={{
              background: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid var(--accent-xp)',
              borderRadius: '6px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-xp)' }}>Contrato de Intercambio (10 a 1)</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Selecciona 10 skins de rareza <strong>{tradeUpRarity.toUpperCase()}</strong> para forjar 1 skin de rareza superior.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rareza de entrada:</span>
                {(['common', 'rare', 'epic'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      soundFX.playClick();
                      setTradeUpRarity(r);
                      setSelectedTradeUpIds([]);
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '3px',
                      border: `1px solid var(--rarity-${r})`,
                      background: tradeUpRarity === r ? `var(--rarity-${r})` : 'transparent',
                      color: tradeUpRarity === r ? '#fff' : `var(--rarity-${r})`,
                      cursor: 'pointer',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 700 }}>
                Skins seleccionadas: <span style={{ color: selectedTradeUpIds.length === 10 ? 'var(--accent-primary)' : 'var(--accent-xp)' }}>{selectedTradeUpIds.length} / 10</span>
              </div>
              <button
                className="btn-action"
                onClick={submitTradeUp}
                disabled={selectedTradeUpIds.length !== 10 || submittingTradeUp}
                style={{
                  background: selectedTradeUpIds.length === 10 ? 'var(--accent-primary)' : 'var(--border)',
                  color: selectedTradeUpIds.length === 10 ? '#000' : 'var(--text-muted)',
                  padding: '0.5rem 1.25rem',
                  fontWeight: 700,
                }}
              >
                {submittingTradeUp ? 'Forjando contrato...' : 'Forjar Contrato'}
              </button>
            </div>
          </div>
        )}

        {/* Stats & Filters Bar */}
        <div className="ledger-meta" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
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
              Suerte: {dropStats.luckRating === 'lucky' ? 'Alta' : dropStats.luckRating === 'unlucky' ? 'Baja' : 'Promedio'} ({dropStats.luckScorePercent}%)
            </span>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              {RARITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { soundFX.playClick(); setRarityFilter(opt.id); }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '3px',
                    border: `1px solid ${rarityFilter === opt.id ? 'var(--accent-primary)' : 'var(--border)'}`,
                    background: rarityFilter === opt.id ? 'var(--accent-primary)' : 'transparent',
                    color: rarityFilter === opt.id ? 'var(--bg-main)' : 'var(--text-muted)',
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
                <option key={s.id} value={s.id}>{s.label}</option>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0 0.5rem' }}>
            <button className="btn-action" onClick={refreshPrices} disabled={pricing}>
              {pricing ? 'Consultando a Steam...' : 'Actualizar precios'}
            </button>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
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
              const tradeUpSelectedCount = selectedTradeUpIds.filter((id) => id === item.id).length;
              const isEligibleForTradeUp = tradeUpMode && item.rarity === tradeUpRarity;

              return (
                <article
                  key={item.id}
                  className="inventory-card"
                  role="button"
                  tabIndex={0}
                  style={{
                    ['--cell-rarity' as string]: `var(--rarity-${item.rarity ?? 'common'})`,
                    cursor: 'pointer',
                    outline: tradeUpSelectedCount > 0 ? '2px solid var(--accent-xp)' : undefined,
                    opacity: tradeUpMode && !isEligibleForTradeUp ? 0.35 : 1,
                  }}
                  onClick={() => {
                    if (tradeUpMode) {
                      toggleTradeUpSelection(item);
                    } else {
                      soundFX.playClick();
                      setInspectingItem(item);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (tradeUpMode) {
                        toggleTradeUpSelection(item);
                      } else {
                        soundFX.playClick();
                        setInspectingItem(item);
                      }
                    }
                  }}
                  title={`Clic o Enter para ${tradeUpMode ? 'seleccionar en Trade-Up' : 'inspeccionar detalle'}`}
                  aria-label={`${item.name} (${item.rarity ?? 'common'})`}
                >
                  <div className="inventory-art">
                    {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="reel-item-blank" />}
                    {item.count > 1 && <span className="inventory-count">&times;{item.count}</span>}
                    {tradeUpSelectedCount > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '6px',
                          left: '6px',
                          background: 'var(--accent-xp)',
                          color: '#000',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '3px',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        ✓ {tradeUpSelectedCount}
                      </span>
                    )}
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
                      {!tradeUpMode && (
                        <button
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
                      )}
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

      <MobileNav activeTab="inventory" />
    </div>
  );
}
