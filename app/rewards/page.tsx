'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import FadeIn from '@/components/FadeIn';
import ChestReel from '@/components/ChestReel';

interface Reward {
  id: string;
  type: 'shop' | 'chest' | 'chest_item';
  name: string;
  xp_cost: number;
  rarity: string | null;
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [name, setName] = useState('');
  const [xpCost, setXpCost] = useState(10);
  const [type, setType] = useState<'shop' | 'chest' | 'chest_item'>('shop');
  const [rarity, setRarity] = useState('common');
  const [message, setMessage] = useState('');
  const [chestWinner, setChestWinner] = useState<{ id: string; name: string; rarity: string } | null>(null);
  const [revealedItem, setRevealedItem] = useState<{ name: string; rarity: string } | null>(null);
  const [supabase] = useState(() => createBrowserClient());
  const router = useRouter();

  async function loadRewards() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data } = await supabase.from('rewards').select('*').eq('user_id', user.id);
    setRewards(data ?? []);
  }

  useEffect(() => {
    loadRewards();
  }, []);

  async function createReward() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('rewards').insert({
      user_id: user.id,
      type,
      name,
      // chest_item rows keep a placeholder xp_cost (schema requires > 0) but it's never read for payment.
      xp_cost: xpCost,
      rarity: type === 'chest_item' ? rarity : null,
    });
    setName('');
    await loadRewards();
  }

  async function redeem(reward: Reward) {
    const res = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewardId: reward.id }),
    });
    const data = await res.json();

    if (data.error) {
      setMessage(`Error: ${data.error}`);
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    if (reward.type === 'chest' && data.redeemed.id) {
      setChestWinner(data.redeemed);
      return;
    }

    setMessage(`¡Obtuviste: ${data.redeemed.name}!`);
    setTimeout(() => setMessage(''), 5000);
  }

  const chestItemPool = rewards
    .filter((r) => r.type === 'chest_item')
    .map((r) => ({ id: r.id, name: r.name, rarity: (r.rarity ?? 'common') as 'common' | 'rare' | 'epic' }));

  return (
    <FadeIn>
      <main className="container">
        <Header left={<h1 style={{ margin: 0, fontSize: '1.75rem' }}>Recompensas</h1>}>
          <a href="/" className="nav-link">
            ← Volver al inicio
          </a>
        </Header>

        {chestWinner && (
          <ChestReel
            pool={chestItemPool}
            winnerId={chestWinner.id}
            onDone={() => {
              setRevealedItem({ name: chestWinner.name, rarity: chestWinner.rarity });
              setChestWinner(null);
              setTimeout(() => setRevealedItem(null), 5000);
            }}
          />
        )}

        {revealedItem && (
          <div className="alert pop-in">
            ¡Obtuviste: {revealedItem.name}!{' '}
            <span className={`rarity-badge rarity-${revealedItem.rarity}`}>{revealedItem.rarity}</span>
          </div>
        )}

        {message && <div className={`alert ${message.startsWith('Error') ? 'error' : ''}`}>{message}</div>}

        <div className="grid">
          <aside>
            <section className="card">
              <h2 className="card-title">Nueva recompensa</h2>
              <div className="form-group">
                <label>Nombre</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. 1 hora de juego" />
              </div>
              <div className="form-group">
                <label>Costo XP</label>
                <input type="number" value={xpCost} onChange={(e) => setXpCost(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={type} onChange={(e) => setType(e.target.value as 'shop' | 'chest' | 'chest_item')}>
                  <option value="shop">Tienda</option>
                  <option value="chest">Cofre</option>
                  <option value="chest_item">Objeto de cofre</option>
                </select>
              </div>
              {type === 'chest_item' && (
                <div className="form-group">
                  <label>Rareza</label>
                  <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
                    <option value="common">Común</option>
                    <option value="rare">Raro</option>
                    <option value="epic">Épico</option>
                  </select>
                </div>
              )}
              <button className="btn" onClick={createReward} style={{ marginTop: '1rem' }}>
                Crear
              </button>
            </section>
          </aside>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <section className="card">
              <h2 className="card-title">Tienda</h2>
              {rewards.filter((r) => r.type === 'shop').length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No hay objetos en la tienda.</p>
              ) : (
                <div className="reward-grid">
                  {rewards
                    .filter((r) => r.type === 'shop')
                    .map((r) => (
                      <div key={r.id} className="reward-item">
                        <span className="reward-name">{r.name}</span>
                        <span className="reward-cost">{r.xp_cost} XP</span>
                        <button className="btn-action" onClick={() => redeem(r)}>
                          Canjear
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </section>

            <section className="card">
              <h2 className="card-title">Cofres</h2>
              {rewards.filter((r) => r.type === 'chest').length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No hay cofres disponibles.</p>
              ) : (
                <div className="reward-grid">
                  {rewards
                    .filter((r) => r.type === 'chest')
                    .map((r) => (
                      <div key={r.id} className="reward-item">
                        <span className="reward-name">📦 {r.name}</span>
                        <span className="reward-cost">{r.xp_cost} XP</span>
                        <button className="btn-action" onClick={() => redeem(r)} disabled={!!chestWinner}>
                          Abrir
                        </button>
                      </div>
                    ))}
                </div>
              )}

              <h3 style={{ marginTop: '2rem', fontSize: '1rem', color: 'var(--text-muted)' }}>Premios posibles</h3>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {rewards
                  .filter((r) => r.type === 'chest_item')
                  .map((r) => (
                    <li
                      key={r.id}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                      }}
                    >
                      {r.name} <span className={`rarity-badge rarity-${r.rarity}`}>{r.rarity}</span>
                    </li>
                  ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </FadeIn>
  );
}
