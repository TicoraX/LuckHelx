'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

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

  async function redeem(rewardId: string) {
    const res = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewardId }),
    });
    const data = await res.json();
    setMessage(data.error ? `Error: ${data.error}` : `Obtuviste: ${data.redeemed.name}`);
  }

  return (
    <main>
      <h1>Recompensas</h1>
      {message && <p>{message}</p>}

      <section>
        <h2>Crear recompensa</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="nombre" />
        <input type="number" value={xpCost} onChange={(e) => setXpCost(Number(e.target.value))} />
        <select value={type} onChange={(e) => setType(e.target.value as 'shop' | 'chest' | 'chest_item')}>
          <option value="shop">tienda</option>
          <option value="chest">cofre (costo fijo por abrir)</option>
          <option value="chest_item">objeto de cofre (premio, sin costo propio)</option>
        </select>
        {type === 'chest_item' && (
          <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
            <option value="common">comun</option>
            <option value="rare">raro</option>
            <option value="epic">epico</option>
          </select>
        )}
        <button onClick={createReward}>Crear</button>
      </section>

      <section>
        <h2>Tienda</h2>
        <ul>
          {rewards.filter((r) => r.type === 'shop').map((r) => (
            <li key={r.id}>
              {r.name} ({r.xp_cost} xp) <button onClick={() => redeem(r.id)}>Canjear</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Cofres</h2>
        <ul>
          {rewards.filter((r) => r.type === 'chest').map((r) => (
            <li key={r.id}>
              {r.name} ({r.xp_cost} xp) <button onClick={() => redeem(r.id)}>Abrir</button>
            </li>
          ))}
        </ul>
        <h3>Premios posibles</h3>
        <ul>
          {rewards.filter((r) => r.type === 'chest_item').map((r) => (
            <li key={r.id}>{r.name} [{r.rarity}]</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
