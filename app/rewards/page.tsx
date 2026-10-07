'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import ChestReel from '@/components/ChestReel';
import Toast, { useToast } from '@/components/Toast';
import Confetti from '@/components/Confetti';
import ConfirmModal from '@/components/ConfirmModal';
import StreakBadge from '@/components/StreakBadge';
import MobileNav from '@/components/MobileNav';
import BatchOpeningModal from '@/components/BatchOpeningModal';
import CollectionsModal from '@/components/CollectionsModal';
import CaseBattleModal from '@/components/CaseBattleModal';
import type { BatchWonItem } from '@/lib/batch-open';
import { soundFX } from '@/lib/sound';
import { calculateStreakFromDates } from '@/lib/streak';
import type { Rarity } from '@/lib/rewards';
import { XP_SCALE, formatXp, parseXpInput } from '@/lib/xp';
import {
  IconDashboard,
  IconGift,
  IconChest,
  IconSparkles,
  IconLightning,
  IconPlus,
  IconLedger,
  IconEdit,
  IconTrash,
} from '@/components/Icons';

interface Reward {
  id: string;
  type: 'shop' | 'chest' | 'chest_item';
  name: string;
  xp_cost: number;
  rarity: string | null;
  image?: string | null;
  rarity_color?: string | null;
  hasRareDrop?: boolean;
  created_at: string;
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [xpBalance, setXpBalance] = useState<number>(0);
  const [streak, setStreak] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  // Texto, no número: el costo se escribe en XP con decimales ("0,39") y se convierte a
  // unidades recién al enviar. Guardar el número acá obligaba a redondear mientras el
  // usuario todavía está tipeando.
  const [xpCost, setXpCost] = useState('10');
  const [type, setType] = useState<'shop' | 'chest' | 'chest_item'>('shop');
  const [rarity, setRarity] = useState('common');
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [deletingReward, setDeletingReward] = useState<Reward | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Una sola apertura en curso, con todo lo que el escenario necesita. Antes esto vivía
  // en tres estados sueltos (`chestWinner`, `revealedItem`, `openingChestId`) que se
  // apagaban en momentos distintos, y el premio terminaba renderizado fuera del overlay.
  const [opening, setOpening] = useState<{
    chestId: string;
    chestName: string;
    chestImage?: string | null;
    item: { id: string; name: string; rarity: string; image?: string | null; rarityColor?: string | null };
  } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [skipSpin, setSkipSpin] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [spinDurationMs, setSpinDurationMs] = useState<number | undefined>(undefined);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confirmRedeemReward, setConfirmRedeemReward] = useState<Reward | null>(null);
  const [fastOpen, setFastOpen] = useState(false);
  const [batchResult, setBatchResult] = useState<{ chestName: string; items: BatchWonItem[]; totalXpSpent: number } | null>(null);
  const [batchOpeningId, setBatchOpeningId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'shop' | 'chests' | 'catalog'>('shop');
  const [chestContents, setChestContents] = useState<{ chestId: string; chestItemId: string }[]>([]);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const [chestSearch, setChestSearch] = useState('');
  const [chestMinXp, setChestMinXp] = useState('');
  const [chestMaxXp, setChestMaxXp] = useState('');
  const [chestRareOnly, setChestRareOnly] = useState(false);
  const [chestSort, setChestSort] = useState<'newest' | 'oldest'>('newest');
  const [showCollections, setShowCollections] = useState(false);
  const [chestPage, setChestPage] = useState(0);
  const [catalogPage, setCatalogPage] = useState(0);
  const [battleChest, setBattleChest] = useState<Reward | null>(null);
  const [keyCost, setKeyCost] = useState<number>(0);

  const { toasts, showToast, dismissToast } = useToast();

  const loadRewards = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/rewards');
      if (!res.ok) throw new Error('rewards request failed');
      const data = await res.json();
      setXpBalance(data.xpBalance ?? 0);
      setRewards(data.rewards ?? []);
      setChestContents(data.chestContents ?? []);

      const stateRes = await fetch('/api/state');
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        setStreak(calculateStreakFromDates((stateData.tasks ?? []).map((t: { completed_at: string | null }) => t.completed_at)));
      }
    } catch {
      setError('No se pudieron cargar tus recompensas. Reintentá más tarde.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  useEffect(() => {
    setChestPage(0);
  }, [chestSearch, chestMinXp, chestMaxXp, chestRareOnly, chestSort]);

  // Calibracion del sonido de apertura, configurable desde Ajustes. Si la peticion falla,
  // ChestReel y soundFX se quedan con sus defaults en vez de dejar el carrete sin girar.
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.openingSound) {
          setSpinDurationMs(data.openingSound.spinDurationMs);
          soundFX.configureOpening(data.openingSound.offsetSeconds, data.openingSound.custom);
        }
        if (data.saleEconomy?.keyCostXpUnits !== undefined) {
          setKeyCost(data.saleEconomy.keyCostXpUnits);
        }
      })
      .catch(() => {});
  }, []);

  // Escape hace lo mismo que el click en el fondo: si todavia gira, saltea; si ya revelo,
  // cierra. El premio no depende de esto, se decidio en el servidor antes de animar nada.
  useEffect(() => {
    if (!opening) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (revealed) closeOpening();
        else setSkipSpin(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening, revealed]);

  function startEditReward(r: Reward) {
    soundFX.playClick();
    setEditingReward(r);
    setName(r.name);
    setXpCost(String(r.xp_cost / XP_SCALE));
    setType(r.type);
    setRarity(r.rarity ?? 'common');
  }

  function cancelEdit() {
    soundFX.playClick();
    setEditingReward(null);
    setName('');
    setXpCost('10');
    setType('shop');
    setRarity('common');
  }

  async function saveReward() {
    if (!name.trim()) return;

    const xpCostUnits = parseXpInput(xpCost);
    if (xpCostUnits === null || xpCostUnits <= 0) {
      showToast('El costo tiene que ser un número mayor que cero', 'error');
      return;
    }

    soundFX.playClick();
    setSubmitting(true);

    try {
      if (editingReward) {
        const res = await fetch(`/api/rewards/${editingReward.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            xpCostUnits,
            rarity: editingReward.type === 'chest_item' ? rarity : null,
          }),
        });
        const data = await res.json();
        if (data.error) {
          showToast(data.error, 'error');
        } else {
          showToast('Recompensa actualizada', 'success');
          cancelEdit();
          await loadRewards();
        }
      } else {
        const res = await fetch('/api/rewards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, name: name.trim(), xpCostUnits, rarity: type === 'chest_item' ? rarity : null }),
        });
        const data = await res.json();
        if (data.error) {
          showToast(data.error, 'error');
        } else {
          showToast('Recompensa creada exitosamente', 'success');
          setName('');
          await loadRewards();
        }
      }
    } catch {
      showToast('Error al guardar recompensa', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function executeDeleteReward(rewardId: string) {
    soundFX.playClick();
    setDeletingReward(null);
    try {
      const res = await fetch(`/api/rewards/${rewardId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else if (data.ok) {
        showToast('Recompensa borrada', 'success');
        if (editingReward?.id === rewardId) {
          cancelEdit();
        }
        await loadRewards();
      }
    } catch {
      showToast('Error al borrar la recompensa', 'error');
    }
  }

  async function executeRedeem(reward: Reward) {
    if (redeemingId) return;
    soundFX.playClick();
    setConfirmRedeemReward(null);
    // Se bloquea al despachar el POST, no al recibir la respuesta. El botón solo miraba
    // el estado de apertura, que se seteaba despues de la respuesta, asi que dos clicks
    // rapidos gastaban el XP dos veces.
    setRedeemingId(reward.id);
    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId: reward.id }),
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        showToast(data?.error ?? 'No se pudo canjear la recompensa', 'error');
        return;
      }
      if (reward.type === 'chest' && data.redeemed?.id) {
        openerRef.current = document.activeElement as HTMLElement | null;
        setRevealed(false);
        // Sin animacion cuando el sistema la desaconseja: el giro es decoracion y el
        // canje ya ocurrio en el servidor, saltearlo no cambia el premio.
        setSkipSpin(
          fastOpen ||
            (typeof window !== 'undefined' &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        );
        setOpening({
          chestId: reward.id,
          chestName: data.chestName ?? reward.name,
          chestImage: reward.image,
          item: {
            id: data.redeemed.id,
            name: data.redeemed.name,
            rarity: data.redeemed.rarity ?? 'common',
            image: data.redeemed.image,
            rarityColor: data.redeemed.rarity_color,
          },
        });
        return;
      }

      soundFX.playTaskComplete();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
      showToast(`Canjeaste: ${data.redeemed.name}`, 'success');
      await loadRewards();
    } catch {
      showToast('Error al canjear recompensa', 'error');
    } finally {
      setRedeemingId(null);
    }
  }

  async function executeBatchRedeem(reward: Reward, count: number) {
    if (batchOpeningId) return;
    soundFX.playClick();
    setBatchOpeningId(reward.id);
    try {
      const res = await fetch('/api/rewards/batch-redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chestId: reward.id, count }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error ?? 'Error en apertura múltiple', 'error');
        return;
      }
      soundFX.playLevelUp();
      setBatchResult({
        chestName: data.chestName,
        items: data.items,
        totalXpSpent: data.totalXpSpent,
      });
      await loadRewards();
    } catch {
      showToast('Error en apertura múltiple', 'error');
    } finally {
      setBatchOpeningId(null);
    }
  }

  function finishOpening() {
    // La grabación real ya resuelve sola con el sonido del arma; el sintetizado es para
    // cuando el archivo no está.
    if (!soundFX.isOpeningSamplePlaying()) soundFX.playChestOpen();
    setRevealed(true);
    // Confeti solo cuando hay algo que celebrar. Dispararlo en cada apertura, incluso con
    // una skin comun, gastaba el gesto que deberia marcar el cuchillo.
    if (opening?.item.rarity === 'legendary') {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
    loadRewards();
  }

  function closeOpening() {
    setOpening(null);
    setRevealed(false);
    setSkipSpin(false);
    openerRef.current?.focus();
  }

  const openingChestItemIds = new Set(
    chestContents.filter((link) => link.chestId === opening?.chestId).map((link) => link.chestItemId)
  );
  const chestItemPool = rewards
    .filter((r) => r.type === 'chest_item' && openingChestItemIds.has(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      // El CHECK de rewards.rarity en lib/db.ts ya garantiza que el valor esté dentro
      // del set; acá viaja como string porque llega de un fetch sin tipar.
      rarity: (r.rarity ?? 'common') as Rarity,
      image: r.image,
      rarityColor: r.rarity_color,
    }));

  const getPoolForChest = (chestId: string) => {
    const itemIds = new Set(
      chestContents.filter((link) => link.chestId === chestId).map((link) => link.chestItemId)
    );
    return rewards
      .filter((r) => r.type === 'chest_item' && itemIds.has(r.id))
      .map((r) => ({
        id: r.id,
        name: r.name,
        rarity: (r.rarity ?? 'common') as Rarity,
        image: r.image,
        rarityColor: r.rarity_color,
      }));
  };

  const shopRewards = rewards.filter((r) => r.type === 'shop');
  const chestRewards = rewards.filter((r) => r.type === 'chest');
  const catalogItems = rewards.filter((r) => r.type === 'chest_item');

  const CHESTS_PER_PAGE = 20;
  const CATALOG_PER_PAGE = 20;

  const filteredChestRewards = chestRewards
    .filter((r) => r.name.toLowerCase().includes(chestSearch.trim().toLowerCase()))
    // Un filtro que no parsea no filtra: escribir "0," a medias no puede vaciar la lista.
    .filter((r) => { const min = parseXpInput(chestMinXp); return min === null || r.xp_cost >= min; })
    .filter((r) => { const max = parseXpInput(chestMaxXp); return max === null || r.xp_cost <= max; })
    .filter((r) => (chestRareOnly ? r.hasRareDrop === true : true))
    .sort((a, b) =>
      chestSort === 'newest'
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at)
    );

  const chestTotalPages = Math.max(1, Math.ceil(filteredChestRewards.length / CHESTS_PER_PAGE));
  const chestPageClamped = Math.min(chestPage, chestTotalPages - 1);
  const pagedChestRewards = filteredChestRewards.slice(
    chestPageClamped * CHESTS_PER_PAGE,
    chestPageClamped * CHESTS_PER_PAGE + CHESTS_PER_PAGE
  );

  const catalogTotalPages = Math.max(1, Math.ceil(catalogItems.length / CATALOG_PER_PAGE));
  const catalogPageClamped = Math.min(catalogPage, catalogTotalPages - 1);
  const pagedCatalogItems = catalogItems.slice(
    catalogPageClamped * CATALOG_PER_PAGE,
    catalogPageClamped * CATALOG_PER_PAGE + CATALOG_PER_PAGE
  );

  return (
    <div className="fade-in">
      <Confetti active={showConfetti} />
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        isOpen={!!confirmRedeemReward}
        title={confirmRedeemReward?.type === 'chest' ? 'Abrir cofre' : 'Canjear recompensa'}
        message={`¿Estás seguro de gastar ${formatXp(confirmRedeemReward?.xp_cost ?? 0)} XP para ${
          confirmRedeemReward?.type === 'chest' ? 'abrir el cofre' : 'canjear'
        } "${confirmRedeemReward?.name}"?`}
        confirmText="Confirmar gasto"
        onConfirm={() => confirmRedeemReward && executeRedeem(confirmRedeemReward)}
        onCancel={() => { soundFX.playClick(); setConfirmRedeemReward(null); }}
      />

      <ConfirmModal
        isOpen={!!deletingReward}
        title="¿Borrar esta recompensa?"
        message={`¿Estás seguro de borrar "${deletingReward?.name}"?`}
        confirmText="Borrar"
        cancelText="Cancelar"
        onConfirm={() => deletingReward && executeDeleteReward(deletingReward.id)}
        onCancel={() => setDeletingReward(null)}
      />

      <main className="container">
        {error && (
          <div
            role="alert"
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
          <button className="nav-link active" aria-label="Recompensas">
            <IconGift size={16} /> Recompensas
          </button>
          <a href="/inventory" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconChest size={16} /> Inventario
          </a>
          <a href="/ledger" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconLedger size={16} /> Estado de cuenta
          </a>
          <div className="xp-badge-wrapper">
            <IconLightning size={15} /> {formatXp(xpBalance)} XP
          </div>
          <StreakBadge streak={streak} />
        </Header>

        <div style={{ marginBottom: '1.2rem' }}>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Recompensas</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
            Cajas de CS2 y recompensas canjeables con tu XP acumulado.
          </p>
        </div>

        {/* Escenario de apertura: carrete y reveal viven en la misma superficie. Antes el
            overlay se desmontaba al frenar y el premio aparecia como tarjeta al tope de la
            pagina, detras de lo que el usuario estaba mirando. */}
        {opening && (
          <div
            className="reel-stage"
            role="dialog"
            aria-modal="true"
            aria-label={`Abriendo ${opening.chestName}`}
            onClick={() => (revealed ? closeOpening() : setSkipSpin(true))}
          >
            <div className="reel-stage-inner" onClick={(e) => e.stopPropagation()}>
              <div className="reel-stage-case">{opening.chestName}</div>

              {chestItemPool.length > 0 ? (
                <ChestReel
                  key={skipSpin ? 'skip' : 'spin'}
                  pool={chestItemPool}
                  winnerId={opening.item.id}
                  chestImage={opening.chestImage}
                  spinDurationMs={spinDurationMs}
                  skip={skipSpin}
                  onDone={finishOpening}
                />
              ) : (
                // El canje ya se cobro en el servidor: sin pool que animar, el premio se
                // muestra igual en vez de reventar dentro del efecto de montaje.
                <PoolMissingNotice onMount={finishOpening} />
              )}

              <div aria-live="polite">
                {revealed && (
                  <>
                    {opening.item.image && (
                      <img className="reel-reveal-img" src={opening.item.image} alt="" />
                    )}
                    <h2
                      className="reel-reveal-name"
                      style={{ ['--cell-rarity' as string]: opening.item.rarityColor ?? `var(--rarity-${opening.item.rarity})` }}
                    >
                      {opening.item.name}
                    </h2>
                    <div
                      className="reel-reveal-rarity"
                      style={{ ['--cell-rarity' as string]: opening.item.rarityColor ?? `var(--rarity-${opening.item.rarity})` }}
                    >
                      {opening.item.rarity}
                    </div>
                    <button className="btn" style={{ marginTop: '1.4rem' }} onClick={closeOpening} autoFocus>
                      Continuar
                    </button>
                  </>
                )}
              </div>

              {!revealed && <div className="reel-stage-hint">Escape o click para saltar</div>}
            </div>
          </div>
        )}

        <div className="grid">
          {/* Form Sidebar */}
          <aside>
            <section className="card">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {editingReward ? <IconEdit size={16} color="var(--accent-primary)" /> : <IconPlus size={16} color="var(--accent-primary)" />}
                {editingReward ? 'Editar recompensa' : 'Nueva recompensa'}
              </h2>
              <div className="form-group">
                <label htmlFor="reward-name">Nombre</label>
                <input
                  id="reward-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. 1 hora de videojuego"
                />
              </div>

              <div className="form-group">
                <label htmlFor="reward-cost">Costo en XP</label>
                <input
                  id="reward-cost"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={xpCost}
                  onChange={(e) => setXpCost(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reward-type">Categoría</label>
                <select
                  id="reward-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as 'shop' | 'chest' | 'chest_item')}
                  disabled={!!editingReward}
                >
                  <option value="shop">Tienda (canje directo)</option>
                  <option value="chest">Cofre misterioso</option>
                  <option value="chest_item">Objeto de cofre (premio)</option>
                </select>
              </div>

              {(type === 'chest_item' || editingReward?.type === 'chest_item') && (
                <div className="form-group">
                  <label htmlFor="reward-rarity">Rareza del premio</label>
                  <select id="reward-rarity" value={rarity} onChange={(e) => setRarity(e.target.value)}>
                    <option value="common">Común</option>
                    <option value="rare">Raro</option>
                    <option value="epic">Épico</option>
                    <option value="legendary">Legendario</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button className="btn" onClick={saveReward} disabled={submitting || !name.trim()} style={{ width: '100%' }}>
                  {submitting ? '...' : editingReward ? 'Guardar cambios' : 'Guardar Recompensa'}
                </button>
                {editingReward && (
                  <button className="btn btn-secondary" onClick={cancelEdit} style={{ width: '100%' }}>
                    Cancelar edición
                  </button>
                )}
              </div>
            </section>
          </aside>

          {/* Main Rewards Display — Tabulated Ledger Sheet */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Tabs Header */}
            <div className="tabs-header" style={{ marginBottom: 0 }}>
              <button className={`tab-btn ${activeTab === 'shop' ? 'active' : ''}`} onClick={() => { soundFX.playClick(); setActiveTab('shop'); }}>
                Tienda ({shopRewards.length})
              </button>
              <button className={`tab-btn ${activeTab === 'chests' ? 'active' : ''}`} onClick={() => { soundFX.playClick(); setActiveTab('chests'); }}>
                Cofres ({chestRewards.length})
              </button>
              <button className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => { soundFX.playClick(); setActiveTab('catalog'); }}>
                Colección ({catalogItems.length})
              </button>
            </div>

            {/* Shop Section */}
            {activeTab === 'shop' && (
              <section className="ledger-sheet">
                <div
                  className="ledger-head"
                  style={{ gridTemplateColumns: '1fr 6rem 11.5rem' }}
                >
                  <span>Concepto</span>
                  <span style={{ textAlign: 'right' }}>Costo</span>
                  <span style={{ textAlign: 'right' }}>Acción</span>
                </div>

                {loading ? (
                  <ul className="ledger-list">
                    {[0, 1].map((i) => (
                      <li key={i} className="ledger-row ghost" style={{ gridTemplateColumns: '1fr 6rem 11.5rem' }}>
                        <span>&mdash;</span>
                        <span className="ledger-value">&mdash;</span>
                        <span />
                      </li>
                    ))}
                  </ul>
                ) : shopRewards.length === 0 ? (
                  <>
                    <ul className="ledger-list">
                      {[0, 1].map((i) => (
                        <li key={i} className="ledger-row ghost" style={{ gridTemplateColumns: '1fr 6rem 11.5rem' }}>
                          <span>&mdash;</span>
                          <span className="ledger-value">&mdash;</span>
                          <span />
                        </li>
                      ))}
                    </ul>
                    <p style={{ textAlign: 'center', padding: '1rem 0 1.5rem', color: 'var(--text-muted)', margin: 0 }}>
                      No hay objetos en la tienda aún. Crea uno en el menú lateral.
                    </p>
                  </>
                ) : (
                  <ul className="ledger-list">
                    {shopRewards.map((r) => {
                      const canAfford = xpBalance >= r.xp_cost;
                      return (
                        <li key={r.id} className="ledger-row" style={{ gridTemplateColumns: '1fr 6rem 11.5rem' }}>
                          <span style={{ fontWeight: 500, fontSize: '0.98rem' }}>{r.name}</span>
                          <span className="ledger-value">{formatXp(r.xp_cost)} XP</span>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              className="btn-action"
                              onClick={() => { soundFX.playClick(); setConfirmRedeemReward(r); }}
                              disabled={!canAfford}
                            >
                              {canAfford ? 'Canjear' : 'XP insuficiente'}
                            </button>
                            <button
                              className="btn-action"
                              style={{ padding: '0.45rem 0.55rem', display: 'inline-flex', alignItems: 'center' }}
                              onClick={() => startEditReward(r)}
                              aria-label="Editar recompensa"
                              title="Editar recompensa"
                            >
                              <IconEdit size={15} />
                            </button>
                            <button
                              className="btn-action"
                              style={{ padding: '0.45rem 0.55rem', display: 'inline-flex', alignItems: 'center' }}
                              onClick={() => { soundFX.playClick(); setDeletingReward(r); }}
                              aria-label="Borrar recompensa"
                              title="Borrar recompensa"
                            >
                              <IconTrash size={15} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {/* Chests Section */}
            {activeTab === 'chests' && (
              <>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <input
                    placeholder="Buscar caja..."
                    value={chestSearch}
                    onChange={(e) => setChestSearch(e.target.value)}
                    style={{ flex: '1 1 180px' }}
                  />
                  <input
                    type="number"
                    placeholder="XP min"
                    value={chestMinXp}
                    onChange={(e) => setChestMinXp(e.target.value)}
                    style={{ width: '90px' }}
                  />
                  <input
                    type="number"
                    placeholder="XP max"
                    value={chestMaxXp}
                    onChange={(e) => setChestMaxXp(e.target.value)}
                    style={{ width: '90px' }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <input type="checkbox" checked={chestRareOnly} onChange={(e) => setChestRareOnly(e.target.checked)} />
                    Con cuchillo/guante
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--accent-xp)' }}>
                    <input type="checkbox" checked={fastOpen} onChange={(e) => setFastOpen(e.target.checked)} />
                    ⚡ Apertura rápida
                  </label>
                  <select value={chestSort} onChange={(e) => setChestSort(e.target.value as 'newest' | 'oldest')}>
                    <option value="newest">Más nuevas</option>
                    <option value="oldest">Más viejas</option>
                  </select>
                  <button
                    className="btn-action"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => { soundFX.playClick(); setShowCollections(true); }}
                  >
                    📚 Ver Álbum
                  </button>
                  <button
                    className="btn-action"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', color: '#eab308', borderColor: 'rgba(234, 179, 8, 0.4)' }}
                    onClick={() => {
                      soundFX.playClick();
                      if (chestRewards.length > 0) {
                        setBattleChest(chestRewards[0]);
                      }
                    }}
                  >
                    ⚔️ Case Battle 1v1
                  </button>
                </div>
                <section className="ledger-sheet">
                <div
                  className="ledger-head"
                  style={{ gridTemplateColumns: '1fr 6rem 17rem' }}
                >
                  <span>Concepto</span>
                  <span style={{ textAlign: 'right' }}>Costo</span>
                  <span style={{ textAlign: 'right' }}>Acción</span>
                </div>

                {loading ? (
                  <ul className="ledger-list">
                    {[0].map((i) => (
                      <li key={i} className="ledger-row ghost" style={{ gridTemplateColumns: '1fr 6rem 17rem' }}>
                        <span>&mdash;</span>
                        <span className="ledger-value">&mdash;</span>
                        <span />
                      </li>
                    ))}
                  </ul>
                ) : filteredChestRewards.length === 0 ? (
                  <>
                    <ul className="ledger-list">
                      {[0].map((i) => (
                        <li key={i} className="ledger-row ghost" style={{ gridTemplateColumns: '1fr 6rem 17rem' }}>
                          <span>&mdash;</span>
                          <span className="ledger-value">&mdash;</span>
                          <span />
                        </li>
                      ))}
                    </ul>
                    <p style={{ textAlign: 'center', padding: '1rem 0 1.5rem', color: 'var(--text-muted)', margin: 0 }}>
                      No hay cofres disponibles.
                    </p>
                  </>
                ) : (
                  <ul className="ledger-list">
                    {pagedChestRewards.map((r) => {
                      const canAfford = xpBalance >= r.xp_cost;
                      return (
                        <li key={r.id} className="ledger-row" style={{ gridTemplateColumns: '1fr 6rem 17rem' }}>
                          <span style={{ fontWeight: 500, fontSize: '0.98rem' }}>{r.name}</span>
                          <span className="ledger-value">{formatXp(r.xp_cost)} XP</span>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              className="btn-action"
                              onClick={() => { soundFX.playClick(); setBattleChest(r); }}
                              disabled={xpBalance < r.xp_cost + keyCost || !!opening || !!redeemingId || !!batchOpeningId}
                              title="Duelo 1v1 contra bot (Winner takes all)"
                              style={{ fontWeight: 700, padding: '0.45rem 0.55rem', fontSize: '0.78rem', color: '#eab308' }}
                            >
                              ⚔️ 1v1
                            </button>
                            <button
                              className="btn-action"
                              onClick={() => { soundFX.playClick(); setConfirmRedeemReward(r); }}
                              disabled={!canAfford || !!opening || !!redeemingId || !!batchOpeningId}
                            >
                              {redeemingId === r.id
                                ? 'Abriendo...'
                                : canAfford
                                ? 'Abrir'
                                : `Faltan ${formatXp(r.xp_cost - xpBalance)}`}
                            </button>
                            <button
                              className="btn-action"
                              onClick={() => executeBatchRedeem(r, 5)}
                              disabled={xpBalance < r.xp_cost * 5 || !!opening || !!redeemingId || !!batchOpeningId}
                              title="Abrir 5 cajas en lote"
                              style={{ fontWeight: 700, padding: '0.45rem 0.6rem', fontSize: '0.78rem' }}
                            >
                              {batchOpeningId === r.id ? '...' : '5x'}
                            </button>
                            <button
                              className="btn-action"
                              style={{ padding: '0.45rem 0.55rem', display: 'inline-flex', alignItems: 'center' }}
                              onClick={() => startEditReward(r)}
                              aria-label="Editar cofre"
                              title="Editar cofre"
                            >
                              <IconEdit size={15} />
                            </button>
                            <button
                              className="btn-action"
                              style={{ padding: '0.45rem 0.55rem', display: 'inline-flex', alignItems: 'center' }}
                              onClick={() => { soundFX.playClick(); setDeletingReward(r); }}
                              aria-label="Borrar cofre"
                              title="Borrar cofre"
                            >
                              <IconTrash size={15} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                </section>

                {filteredChestRewards.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <button
                      className="btn-action"
                      onClick={() => setChestPage((p) => Math.max(0, p - 1))}
                      disabled={chestPageClamped === 0}
                    >
                      Anterior
                    </button>
                    <span>Página {chestPageClamped + 1} de {chestTotalPages}</span>
                    <button
                      className="btn-action"
                      onClick={() => setChestPage((p) => Math.min(chestTotalPages - 1, p + 1))}
                      disabled={chestPageClamped >= chestTotalPages - 1}
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Catalog Items Section */}
            {activeTab === 'catalog' && (
              <>
              <section className="ledger-sheet">
                <div
                  className="ledger-head"
                  style={{ gridTemplateColumns: '1fr 7rem 6.5rem' }}
                >
                  <span>Concepto</span>
                  <span>Rareza</span>
                  <span style={{ textAlign: 'right' }}>Acción</span>
                </div>

                {loading ? (
                  <ul className="ledger-list">
                    {[0, 1].map((i) => (
                      <li key={i} className="ledger-row ghost" style={{ gridTemplateColumns: '1fr 7rem 6.5rem' }}>
                        <span>&mdash;</span>
                        <span>&mdash;</span>
                        <span />
                      </li>
                    ))}
                  </ul>
                ) : catalogItems.length === 0 ? (
                  <>
                    <ul className="ledger-list">
                      {[0, 1].map((i) => (
                        <li key={i} className="ledger-row ghost" style={{ gridTemplateColumns: '1fr 7rem 6.5rem' }}>
                          <span>&mdash;</span>
                          <span>&mdash;</span>
                          <span />
                        </li>
                      ))}
                    </ul>
                    <p style={{ textAlign: 'center', padding: '1rem 0 1.5rem', color: 'var(--text-muted)', margin: 0 }}>
                      No se han registrado premios de cofres aún.
                    </p>
                  </>
                ) : (
                  <ul className="ledger-list">
                    {pagedCatalogItems.map((r) => (
                      <li key={r.id} className="ledger-row" style={{ gridTemplateColumns: '1fr 7rem 6.5rem' }}>
                        <span style={{ fontWeight: 500, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {r.image && (
                            <img
                              src={r.image}
                              alt={r.name}
                              style={{ width: '32px', height: '24px', objectFit: 'contain' }}
                            />
                          )}
                          {r.name}
                        </span>
                        <div>
                          <span className={`rarity-badge rarity-${r.rarity}`}>{r.rarity}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            className="btn-action"
                            style={{ padding: '0.45rem 0.55rem', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => startEditReward(r)}
                            aria-label="Editar premio"
                            title="Editar premio"
                          >
                            <IconEdit size={15} />
                          </button>
                          <button
                            className="btn-action"
                            style={{ padding: '0.45rem 0.55rem', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => { soundFX.playClick(); setDeletingReward(r); }}
                            aria-label="Borrar premio"
                            title="Borrar premio"
                          >
                            <IconTrash size={15} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {catalogItems.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <button
                    className="btn-action"
                    onClick={() => setCatalogPage((p) => Math.max(0, p - 1))}
                    disabled={catalogPageClamped === 0}
                  >
                    Anterior
                  </button>
                  <span>Página {catalogPageClamped + 1} de {catalogTotalPages}</span>
                  <button
                    className="btn-action"
                    onClick={() => setCatalogPage((p) => Math.min(catalogTotalPages - 1, p + 1))}
                    disabled={catalogPageClamped >= catalogTotalPages - 1}
                  >
                    Siguiente
                  </button>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      </main>

      <BatchOpeningModal
        isOpen={Boolean(batchResult)}
        chestName={batchResult?.chestName ?? ''}
        items={batchResult?.items ?? []}
        totalXpSpent={batchResult?.totalXpSpent ?? 0}
        onClose={() => setBatchResult(null)}
      />

      <CollectionsModal
        isOpen={showCollections}
        onClose={() => setShowCollections(false)}
      />

      {battleChest && (
        <CaseBattleModal
          chest={battleChest}
          pool={getPoolForChest(battleChest.id)}
          keyCost={keyCost}
          userBalance={xpBalance}
          onClose={() => setBattleChest(null)}
          onBattleComplete={() => loadRewards()}
        />
      )}

      <MobileNav activeTab="rewards" />
    </div>
  );
}

// Un cofre sin objetos vinculados no puede animar nada, pero el XP ya se gasto. Se revela
// igual, sin carrete, en vez de dejar que buildReel tire una excepcion sin capturar.
function PoolMissingNotice({ onMount }: { onMount: () => void }) {
  const firedRef = React.useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onMount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <p style={{ color: 'var(--text-muted)' }}>Este cofre no tiene objetos definidos.</p>;
}
