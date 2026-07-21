'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import ChestReel from '@/components/ChestReel';
import Toast, { useToast } from '@/components/Toast';
import Confetti from '@/components/Confetti';
import ConfirmModal from '@/components/ConfirmModal';
import StreakBadge from '@/components/StreakBadge';
import MobileNav from '@/components/MobileNav';
import { soundFX } from '@/lib/sound';
import { calculateStreakFromDates } from '@/lib/streak';
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
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [xpBalance, setXpBalance] = useState<number>(0);
  const [streak, setStreak] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [xpCost, setXpCost] = useState(10);
  const [type, setType] = useState<'shop' | 'chest' | 'chest_item'>('shop');
  const [rarity, setRarity] = useState('common');
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [deletingReward, setDeletingReward] = useState<Reward | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [chestWinner, setChestWinner] = useState<{ id: string; name: string; rarity: string } | null>(null);
  const [revealedItem, setRevealedItem] = useState<{ name: string; rarity: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confirmRedeemReward, setConfirmRedeemReward] = useState<Reward | null>(null);
  const [activeTab, setActiveTab] = useState<'shop' | 'chests' | 'catalog'>('shop');

  const { toasts, showToast, dismissToast } = useToast();

  const loadRewards = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/rewards');
      if (!res.ok) throw new Error('rewards request failed');
      const data = await res.json();
      setXpBalance(data.xpBalance ?? 0);
      setRewards(data.rewards ?? []);

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

  function startEditReward(r: Reward) {
    soundFX.playClick();
    setEditingReward(r);
    setName(r.name);
    setXpCost(r.xp_cost);
    setType(r.type);
    setRarity(r.rarity ?? 'common');
  }

  function cancelEdit() {
    soundFX.playClick();
    setEditingReward(null);
    setName('');
    setXpCost(10);
    setType('shop');
    setRarity('common');
  }

  async function saveReward() {
    if (!name.trim()) return;
    soundFX.playClick();
    setSubmitting(true);

    try {
      if (editingReward) {
        const res = await fetch(`/api/rewards/${editingReward.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            xpCost,
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
          body: JSON.stringify({ type, name: name.trim(), xpCost, rarity: type === 'chest_item' ? rarity : null }),
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
    soundFX.playClick();
    setConfirmRedeemReward(null);
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
        showToast(data?.error ? `Error al crear recompensa: ${data.error}` : 'Error al crear recompensa', 'error');
        return;
      }
      if (reward.type === 'chest' && data.redeemed.id) {
        setChestWinner(data.redeemed);
        return;
      }

      soundFX.playTaskComplete();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
      showToast(`Canjeaste: ${data.redeemed.name}`, 'success');
      await loadRewards();
    } catch {
      showToast('Error al canjear recompensa', 'error');
    }
  }

  const chestItemPool = rewards
    .filter((r) => r.type === 'chest_item')
    .map((r) => ({ id: r.id, name: r.name, rarity: (r.rarity ?? 'common') as 'common' | 'rare' | 'epic' }));

  const shopRewards = rewards.filter((r) => r.type === 'shop');
  const chestRewards = rewards.filter((r) => r.type === 'chest');
  const catalogItems = rewards.filter((r) => r.type === 'chest_item');

  return (
    <div className="fade-in">
      <Confetti active={showConfetti} />
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        isOpen={!!confirmRedeemReward}
        title={confirmRedeemReward?.type === 'chest' ? 'Abrir cofre' : 'Canjear recompensa'}
        message={`¿Estás seguro de gastar ${confirmRedeemReward?.xp_cost} XP para ${
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
          <a href="/ledger" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconLedger size={16} /> Estado de cuenta
          </a>
          <div className="xp-badge-wrapper">
            <IconLightning size={15} /> {xpBalance} XP
          </div>
          <StreakBadge streak={streak} />
        </Header>

        {/* Chest Winner Reveal Overlay */}
        {chestWinner && (
          <div className="modal-backdrop">
            <div className="modal-dialog" style={{ maxWidth: '680px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.6rem', marginBottom: '1rem' }}>Abriendo cofre del tesoro</h2>
              <ChestReel
                pool={chestItemPool}
                winnerId={chestWinner.id}
                onDone={() => {
                  soundFX.playChestOpen();
                  setRevealedItem({ name: chestWinner.name, rarity: chestWinner.rarity });
                  setChestWinner(null);
                  setShowConfetti(true);
                  setTimeout(() => setShowConfetti(false), 4000);
                  loadRewards();
                }}
              />
            </div>
          </div>
        )}

        {/* Revealed Winner Alert */}
        {revealedItem && (
          <div
            className="card"
            style={{
              marginBottom: '2rem',
              textAlign: 'center',
              boxShadow: 'var(--shadow-stamp)',
            }}
          >
            <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}>
              <IconSparkles size={36} color="var(--accent-primary)" />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Obtuviste:</h2>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              {revealedItem.name}
            </div>
            <span className={`rarity-badge rarity-${revealedItem.rarity}`}>{revealedItem.rarity}</span>
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
                  min="1"
                  value={xpCost}
                  onChange={(e) => setXpCost(Number(e.target.value))}
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
                          <span className="ledger-value">{r.xp_cost} XP</span>
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
                    {[0].map((i) => (
                      <li key={i} className="ledger-row ghost" style={{ gridTemplateColumns: '1fr 6rem 11.5rem' }}>
                        <span>&mdash;</span>
                        <span className="ledger-value">&mdash;</span>
                        <span />
                      </li>
                    ))}
                  </ul>
                ) : chestRewards.length === 0 ? (
                  <>
                    <ul className="ledger-list">
                      {[0].map((i) => (
                        <li key={i} className="ledger-row ghost" style={{ gridTemplateColumns: '1fr 6rem 11.5rem' }}>
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
                    {chestRewards.map((r) => {
                      const canAfford = xpBalance >= r.xp_cost;
                      return (
                        <li key={r.id} className="ledger-row" style={{ gridTemplateColumns: '1fr 6rem 11.5rem' }}>
                          <span style={{ fontWeight: 500, fontSize: '0.98rem' }}>{r.name}</span>
                          <span className="ledger-value">{r.xp_cost} XP</span>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              className="btn-action"
                              onClick={() => { soundFX.playClick(); setConfirmRedeemReward(r); }}
                              disabled={!canAfford || !!chestWinner}
                            >
                              {canAfford ? 'Abrir cofre' : 'XP insuficiente'}
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
            )}

            {/* Catalog Items Section */}
            {activeTab === 'catalog' && (
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
                    {catalogItems.map((r) => (
                      <li key={r.id} className="ledger-row" style={{ gridTemplateColumns: '1fr 7rem 6.5rem' }}>
                        <span style={{ fontWeight: 500, fontSize: '0.98rem' }}>{r.name}</span>
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
            )}
          </div>
        </div>
      </main>

      <MobileNav activeTab="rewards" />
    </div>
  );
}
