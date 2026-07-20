'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { createBrowserClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import XpProgressBar from '@/components/XpProgressBar';
import Toast, { useToast } from '@/components/Toast';
import Confetti from '@/components/Confetti';
import AchievementsModal from '@/components/AchievementsModal';
import HelpModal from '@/components/HelpModal';
import StreakBadge from '@/components/StreakBadge';
import MobileNav from '@/components/MobileNav';
import { soundFX } from '@/lib/sound';
import { calculateStreakFromDates } from '@/lib/streak';
import {
  IconDashboard,
  IconGift,
  IconTrophy,
  IconHelp,
  IconLogout,
} from '@/components/Icons';

interface Task {
  id: string;
  title: string;
  xp_value: number | null;
  status: string;
  completed_at: string | null;
  created_at: string;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short' }).replace('.', '');
}

export default function Home() {
  const [xpBalance, setXpBalance] = useState<number | null>(null);
  const [streak, setStreak] = useState(1);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [redemptionCount, setRedemptionCount] = useState(0);

  const { toasts, showToast, dismissToast } = useToast();
  const previousXpBalanceRef = useRef<number | null>(null);
  const [supabase] = useState(() => createBrowserClient());
  const router = useRouter();

  const loadDashboard = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('xp_balance').eq('id', user.id).single();
      const newXp = profile?.xp_balance ?? 0;

      if (
        previousXpBalanceRef.current !== null &&
        Math.floor(newXp / 100) > Math.floor(previousXpBalanceRef.current / 100)
      ) {
        soundFX.playLevelUp();
        showToast(`Subiste al nivel ${Math.floor(newXp / 100) + 1}`, 'success');
      }

      previousXpBalanceRef.current = newXp;
      setXpBalance(newXp);

      const { data: taskRows } = await supabase
        .from('tasks')
        .select('id, title, xp_value, status, completed_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      const loadedTasks = taskRows ?? [];
      setTasks(loadedTasks);
      setStreak(calculateStreakFromDates(loadedTasks.map((task) => task.completed_at)));

      const { count } = await supabase
        .from('redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      setRedemptionCount(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [supabase, router, showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function signOut() {
    soundFX.playClick();
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    soundFX.playClick();
    setCreating(true);
    try {
      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, description: newDescription }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(`Error: ${data.error}`, 'error');
      } else {
        showToast('Tarea creada exitosamente', 'success');
        setNewTitle('');
        setNewDescription('');
        await loadDashboard();
      }
    } catch {
      showToast('No se pudo crear la tarea', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function completeTask(taskId: string) {
    soundFX.playTaskComplete();
    setCompletingId(taskId);
    try {
      const res = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(`Error: ${data.error}`, 'error');
      } else {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        showToast('Tarea completada, XP acreditado', 'success');
        await loadDashboard();
      }
    } catch {
      showToast('Error al completar tarea', 'error');
    } finally {
      setCompletingId(null);
    }
  }

  const activeTasks = tasks.filter((t) => t.status !== 'credited');

  const filteredTasks = activeTasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));

  const completedCount = tasks.filter((t) => t.status === 'credited').length;

  return (
    <div className="fade-in">
      <Confetti active={showConfetti} />
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <AchievementsModal
        isOpen={showAchievements}
        onClose={() => { soundFX.playClick(); setShowAchievements(false); }}
        xpBalance={xpBalance ?? 0}
        totalTasksCompleted={completedCount}
        totalRewardsRedeemed={redemptionCount}
      />

      <HelpModal
        isOpen={showHelp}
        onClose={() => { soundFX.playClick(); setShowHelp(false); }}
      />

      <main className="container">
        <Header>
          <button className="nav-link active" aria-label="Inicio">
            <IconDashboard size={16} /> Dashboard
          </button>
          <a href="/rewards" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconGift size={16} /> Recompensas
          </a>
          <button className="nav-link" onClick={() => { soundFX.playClick(); setShowAchievements(true); }}>
            <IconTrophy size={16} /> Logros
          </button>
          <button className="nav-link" onClick={() => { soundFX.playClick(); setShowHelp(true); }}>
            <IconHelp size={16} /> Ayuda
          </button>
          <button className="nav-link" onClick={signOut}>
            <IconLogout size={16} /> Salir
          </button>
        </Header>

        {/* Masthead — unboxed, sits on the page background */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Hola de nuevo</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
              Crea y completa tareas para ganar XP y desbloquear recompensas.
            </p>
          </div>
          <StreakBadge streak={streak} />
        </div>
        <div style={{ maxWidth: '320px', marginBottom: '1.75rem' }}>
          <XpProgressBar xp={xpBalance ?? 0} />
        </div>

        {/* Dense metadata line — counts only; XP appears large exactly once, in the footer */}
        <div className="ledger-meta">
          <span>{activeTasks.length} pendientes &middot; {completedCount} completadas &middot; racha {streak}d</span>
          <input
            type="text"
            placeholder="Buscar tarea..."
            aria-label="Buscar tarea"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '220px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
          />
        </div>

        {/* The ledger sheet — one continuous surface, not stacked cards */}
        <section className="ledger-sheet">
          <div className="ledger-head">
            <span>Fecha</span>
            <span>Concepto</span>
            <span>XP</span>
            <span>Estado</span>
            <span />
          </div>

          {loading ? (
            <ul className="ledger-list">
              {[0, 1, 2].map((i) => (
                <li key={i} className="ledger-row ghost">
                  <span className="ledger-date">&mdash;</span>
                  <span>&mdash;</span>
                  <span className="ledger-value">&mdash;</span>
                  <span className="ledger-status">&mdash;</span>
                  <span />
                </li>
              ))}
            </ul>
          ) : filteredTasks.length === 0 ? (
            <>
              <ul className="ledger-list">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="ledger-row ghost">
                    <span className="ledger-date" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>&mdash;</span>
                    <span>&mdash;</span>
                    <span className="ledger-value">&mdash;</span>
                    <span className="ledger-status">&mdash;</span>
                    <span />
                  </li>
                ))}
              </ul>
              <p style={{ textAlign: 'center', padding: '1rem 0 1.5rem', color: 'var(--text-muted)', margin: 0 }}>
                {search ? 'No se encontraron tareas con ese término.' : 'No tienes tareas activas todavía.'}
              </p>
            </>
          ) : (
            <ul className="ledger-list">
              <AnimatePresence initial={false}>
                {filteredTasks.map((task) => (
                  <motion.li
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                    transition={{ duration: 0.25 }}
                    className="ledger-row"
                  >
                    <span className="ledger-date" style={{ color: 'var(--text-dim)' }}>
                      {formatShortDate(task.created_at)}
                    </span>
                    <span style={{ fontWeight: 500, fontSize: '1.02rem' }}>{task.title}</span>
                    <span className="ledger-value">+{task.xp_value ?? '?'}</span>
                    <span className="ledger-status" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {task.status}
                    </span>
                    <button
                      className="btn-action"
                      onClick={() => completeTask(task.id)}
                      disabled={completingId === task.id}
                    >
                      {completingId === task.id ? '...' : 'Completar'}
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          {/* Blank entry row — the create-task form, not a separate card */}
          <div className="ledger-row-new">
            <span className="ledger-gutter">+</span>
            <div>
              <input
                aria-label="Título de la nueva tarea"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="¿Qué necesitas hacer hoy?"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTitle.trim() && !creating) createTask();
                }}
                style={{ border: 'none', background: 'transparent', padding: '0.2rem 0', fontSize: '1.02rem' }}
              />
              {newTitle.trim() && (
                <input
                  aria-label="Descripción de la tarea"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Detalles adicionales o notas (opcional)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTitle.trim() && !creating) createTask();
                  }}
                  style={{ marginTop: '0.4rem', fontSize: '0.88rem' }}
                />
              )}
            </div>
            <span className="ledger-value" style={{ color: 'var(--text-dim)' }}>&mdash;</span>
            <span className="ledger-status" style={{ color: 'var(--text-dim)' }}>&mdash;</span>
            {newTitle.trim() && (
              <button className="btn-action" onClick={createTask} disabled={creating}>
                {creating ? '...' : 'Guardar'}
              </button>
            )}
          </div>

          <div className="ledger-foot">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Saldo total</span>
            <span className="ledger-total">{xpBalance ?? 0} XP</span>
          </div>
        </section>
      </main>

      <MobileNav
        activeTab="dashboard"
        onOpenAchievements={() => setShowAchievements(true)}
      />
    </div>
  );
}
