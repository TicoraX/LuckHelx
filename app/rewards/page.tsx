'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import ChestReel from '@/components/ChestReel';
import Toast, { useToast } from '@/components/Toast';
import Confetti from '@/components/Confetti';
import ConfirmModal from '@/components/ConfirmModal';
import StreakBadge from '@/components/StreakBadge';
import MobileNav from '@/components/MobileNav';
import { soundFX } from '@/lib/sound';
import { calculateStreakFromDates } from '@/lib/streak';

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
  const [name, setName] = useState('');
  const [xpCost, setXpCost] = useState(10);
  const [type, setType] = useState<'shop' | 'chest' | 'chest_item'>('shop');
  const [rarity, setRarity] = useState('common');
  const [chestWinner, setChestWinner] = useState<{ id: string; name: string; rarity: string } | null>(null);
  const [revealedItem, setRevealedItem] = useState<{ name: string; rarity: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confirmReward, setConfirmReward] = useState<Reward | null>(null);
  const [activeTab, setActiveTab] = useState<'shop' | 'chests' | 'catalog'>('shop');

  const { toasts, showToast, dismissToast } = useToast();
  const [supabase] = useState(() => createBrowserClient());
  const router = useRouter();

  const loadRewards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('xp_balance').eq('id', user.id).single();
      setXpBalance(profile?.xp_balance ?? 0);

      const { data: taskRows } = await supabase
        .from('tasks')
        .select('completed_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setStreak(calculateStreakFromDates((taskRows ?? []).map((task) => task.completed_at)));

      const { data } = await supabase.from('rewards').select('*').eq('user_id', user.id);
      setRewards(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  async function createReward() {
    if (!name.trim()) return;
    soundFX.playClick();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('rewards').insert({
      user_id: user.id,
      type,
      name,
      xp_cost: xpCost,
      rarity: type === 'chest_item' ? rarity : null,
    });

    if (error) {
      showToast(`Error al crear recompensa: ${error.message}`, 'error');
      return;
    }

    showToast('Recompensa creada exitosamente', 'success');
    setName('');
    await loadRewards();
  }

  async function executeRedeem(reward: Reward) {
    soundFX.playClick();
    setConfirmReward(null);
    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId: reward.id }),
      });
      const data = await res.json();

      if (data.error) {
        showToast(`Error: ${data.error}`, 'error');
        return;
      }

      if (reward.type === 'chest' && data.redeemed.id) {
        setChestWinner(data.redeemed);
        return;
      }

      soundFX.playTaskComplete();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
      showToast(`🎉 ¡Canjeaste: ${data.redeemed.name}!`, 'success');
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
        isOpen={!!confirmReward}
        title={confirmReward?.type === 'chest' ? '📦 Abrir cofre' : '🛒 Canjear recompensa'}
        message={`¿Estás seguro de gastar ${confirmReward?.xp_cost} XP para ${
          confirmReward?.type === 'chest' ? 'abrir el cofre' : 'canjear'
        } "${confirmReward?.name}"?`}
        confirmText="Confirmar gasto"
        onConfirm={() => confirmReward && executeRedeem(confirmReward)}
        onCancel={() => { soundFX.playClick(); setConfirmReward(null); }}
      />

      <main className="container">
        <Header>
          <a href="/" className="nav-link" onClick={() => soundFX.playClick()}>
            📋 Dashboard
          </a>
          <button className="nav-link active" aria-label="Recompensas">
            🎁 Recompensas
          </button>
          <div className="xp-badge-wrapper">
            ⚡ {xpBalance} XP
          </div>
          <StreakBadge streak={streak} />
        </Header>

        {/* Chest Winner Reveal Overlay */}
        {chestWinner && (
          <div className="modal-backdrop">
            <div className="modal-dialog" style={{ maxWidth: '680px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.6rem', marginBottom: '1rem' }}>📦 ¡Abriendo Cofre del Tesoro!</h2>
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

        {/* Revealed Winner Toast Alert */}
        {revealedItem && (
          <div
            className="glass-card"
            style={{
              marginBottom: '2rem',
              textAlign: 'center',
              border: '2px solid var(--accent-primary)',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✨</div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>¡Felicidades! Obtuviste:</h2>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              {revealedItem.name}
            </div>
            <span className={`rarity-badge rarity-${revealedItem.rarity}`}>{revealedItem.rarity}</span>
          </div>
        )}

        <div className="grid">
          {/* Create Reward Sidebar */}
          <aside>
            <section className="glass-card">
              <h2 className="card-title">➕ Nueva recompensa</h2>
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
                <select id="reward-type" value={type} onChange={(e) => setType(e.target.value as 'shop' | 'chest' | 'chest_item')}>
                  <option value="shop">🛒 Tienda (Canje directo)</option>
                  <option value="chest">📦 Cofre Misterioso</option>
                  <option value="chest_item">✨ Objeto de Cofre (Premio)</option>
                </select>
              </div>

              {type === 'chest_item' && (
                <div className="form-group">
                  <label htmlFor="reward-rarity">Rareza del premio</label>
                  <select id="reward-rarity" value={rarity} onChange={(e) => setRarity(e.target.value)}>
                    <option value="common">⚪ Común</option>
                    <option value="rare">🔵 Raro</option>
                    <option value="epic">🟣 Épico</option>
                  </select>
                </div>
              )}

              <button className="btn" onClick={createReward} disabled={!name.trim()} style={{ marginTop: '0.75rem', width: '100%' }}>
                Guardar Recompensa
              </button>
            </section>
          </aside>

          {/* Main Rewards Display */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Tabs Header */}
            <div className="tabs-header">
              <button className={`tab-btn ${activeTab === 'shop' ? 'active' : ''}`} onClick={() => { soundFX.playClick(); setActiveTab('shop'); }}>
                🛒 Tienda ({shopRewards.length})
              </button>
              <button className={`tab-btn ${activeTab === 'chests' ? 'active' : ''}`} onClick={() => { soundFX.playClick(); setActiveTab('chests'); }}>
                📦 Cofres ({chestRewards.length})
              </button>
              <button className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => { soundFX.playClick(); setActiveTab('catalog'); }}>
                ✨ Colección ({catalogItems.length})
              </button>
            </div>

            {/* Shop Section */}
            {activeTab === 'shop' && (
              <section className="glass-card">
                <h2 className="card-title">🛒 Objetos de la Tienda</h2>
                {loading ? (
                  <div className="reward-grid">
                    <div className="skeleton" style={{ height: '140px' }} />
                    <div className="skeleton" style={{ height: '140px' }} />
                  </div>
                ) : shopRewards.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No hay objetos en la tienda aún. ¡Crea uno en el menú lateral!
                  </div>
                ) : (
                  <div className="reward-grid">
                    {shopRewards.map((r) => {
                      const canAfford = xpBalance >= r.xp_cost;
                      return (
                        <div key={r.id} className="reward-item">
                          <span style={{ fontSize: '1.8rem' }}>🎁</span>
                          <span className="reward-name">{r.name}</span>
                          <span className="reward-cost">⚡ {r.xp_cost} XP</span>
                          <button
                            className="btn-action"
                            onClick={() => { soundFX.playClick(); setConfirmReward(r); }}
                            disabled={!canAfford}
                          >
                            {canAfford ? 'Canjear' : 'XP Insuficiente'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Chests Section */}
            {activeTab === 'chests' && (
              <section className="glass-card">
                <h2 className="card-title">📦 Cofres Misteriosos</h2>
                {loading ? (
                  <div className="reward-grid">
                    <div className="skeleton" style={{ height: '140px' }} />
                  </div>
                ) : chestRewards.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No hay cofres disponibles.
                  </div>
                ) : (
                  <div className="reward-grid">
                    {chestRewards.map((r) => {
                      const canAfford = xpBalance >= r.xp_cost;
                      return (
                        <div key={r.id} className="reward-item">
                          <span style={{ fontSize: '2.2rem' }}>📦</span>
                          <span className="reward-name">{r.name}</span>
                          <span className="reward-cost">⚡ {r.xp_cost} XP</span>
                          <button
                            className="btn-action"
                            onClick={() => { soundFX.playClick(); setConfirmReward(r); }}
                            disabled={!canAfford || !!chestWinner}
                          >
                            {canAfford ? 'Abrir Cofre' : 'XP Insuficiente'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Catalog Items Section */}
            {activeTab === 'catalog' && (
              <section className="glass-card">
                <h2 className="card-title">✨ Catalog de Premios Posibles</h2>
                {catalogItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No se han registrado premios de cofres aún.
                  </div>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {catalogItems.map((r) => (
                      <li
                        key={r.id}
                        style={{
                          background: 'rgba(0, 0, 0, 0.25)',
                          border: '1px solid var(--border)',
                          padding: '0.6rem 1rem',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{r.name}</span>
                        <span className={`rarity-badge rarity-${r.rarity}`}>{r.rarity}</span>
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
