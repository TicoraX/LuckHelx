'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import Toast, { useToast } from '@/components/Toast';
import StreakBadge from '@/components/StreakBadge';
import MobileNav from '@/components/MobileNav';
import { soundFX } from '@/lib/sound';
import { calculateStreakFromDates } from '@/lib/streak';
import {
  IconDashboard,
  IconGift,
  IconLedger,
  IconChest,
} from '@/components/Icons';

interface LedgerEntry {
  id: string;
  kind: 'credit' | 'debit';
  label: string;
  xp: number;
  at: string;
  wonItem: { name: string; rarity: string | null; image: string | null } | null;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short' }).replace('.', '');
}

export default function LedgerPage() {
  const [xpBalance, setXpBalance] = useState<number>(0);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [streak, setStreak] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { toasts, showToast, dismissToast } = useToast();

  const loadLedger = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/ledger');
      if (!res.ok) throw new Error('ledger request failed');
      const data = await res.json();
      setXpBalance(data.xpBalance ?? 0);
      setEntries(data.entries ?? []);

      const stateRes = await fetch('/api/state');
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        setStreak(calculateStreakFromDates((stateData.tasks ?? []).map((t: { completed_at: string | null }) => t.completed_at)));
      }
    } catch {
      setError('No se pudo cargar el estado de cuenta. Reintentá más tarde.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  return (
    <div className="fade-in">
      <Toast toasts={toasts} onDismiss={dismissToast} />

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
          <a href="/inventory" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconChest size={16} /> Inventario
          </a>
          <button className="nav-link active" aria-label="Estado de cuenta">
            <IconLedger size={16} /> Estado de cuenta
          </button>
        </Header>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Estado de cuenta</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
              Historial de acreditaciones y consumos de XP.
            </p>
          </div>
          <StreakBadge streak={streak} />
        </div>

        <div className="ledger-meta">
          <span>{entries.length} movimientos &middot; racha {streak}d</span>
          <span className="mono-value" style={{ fontSize: '0.9rem', color: 'var(--accent-xp)' }}>
            {xpBalance} XP disponible
          </span>
        </div>

        <section className="ledger-sheet">
          <div
            className="ledger-head"
            style={{ gridTemplateColumns: '6.5rem 1fr 7rem' }}
          >
            <span>Fecha</span>
            <span>Concepto</span>
            <span style={{ textAlign: 'right' }}>XP</span>
          </div>

          {loading ? (
            <ul className="ledger-list">
              {[0, 1, 2, 3].map((i) => (
                <li
                  key={i}
                  className="ledger-row ghost"
                  style={{ gridTemplateColumns: '6.5rem 1fr 7rem' }}
                >
                  <span className="ledger-date">&mdash;</span>
                  <span>&mdash;</span>
                  <span className="ledger-value">&mdash;</span>
                </li>
              ))}
            </ul>
          ) : entries.length === 0 ? (
            <>
              <ul className="ledger-list">
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="ledger-row ghost"
                    style={{ gridTemplateColumns: '6.5rem 1fr 7rem' }}
                  >
                    <span className="ledger-date">&mdash;</span>
                    <span>&mdash;</span>
                    <span className="ledger-value">&mdash;</span>
                  </li>
                ))}
              </ul>
              <p style={{ textAlign: 'center', padding: '1rem 0 1.5rem', color: 'var(--text-muted)', margin: 0 }}>
                No hay movimientos registrados en el estado de cuenta.
              </p>
            </>
          ) : (
            <ul className="ledger-list">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="ledger-row"
                  style={{ gridTemplateColumns: '6.5rem 1fr 7rem' }}
                >
                  <span className="ledger-date" style={{ color: 'var(--text-dim)' }}>
                    {formatShortDate(entry.at)}
                  </span>
                  <span style={{ fontWeight: 500, fontSize: '0.98rem' }}>
                    {entry.label}
                    {entry.wonItem && (
                      <span
                        className="ledger-drop"
                        style={{
                          color: entry.wonItem.rarity
                            ? `var(--rarity-${entry.wonItem.rarity})`
                            : 'var(--text-muted)',
                        }}
                      >
                        {entry.wonItem.name}
                      </span>
                    )}
                  </span>
                  <span
                    className="ledger-value"
                    style={{
                      color: entry.xp >= 0 ? 'var(--accent-primary)' : 'var(--rarity-common)',
                    }}
                  >
                    {entry.xp > 0 ? `+${entry.xp}` : entry.xp}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="ledger-foot">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Saldo total</span>
            <span className="ledger-total">{xpBalance} XP</span>
          </div>
        </section>
      </main>

      <MobileNav activeTab="ledger" />
    </div>
  );
}
