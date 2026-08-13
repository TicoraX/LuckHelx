'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '@/components/Header';
import XpProgressBar from '@/components/XpProgressBar';
import Toast, { useToast } from '@/components/Toast';
import Confetti from '@/components/Confetti';
import AchievementsModal from '@/components/AchievementsModal';
import HelpModal from '@/components/HelpModal';
import SettingsModal from '@/components/SettingsModal';
import ConfirmModal from '@/components/ConfirmModal';
import StreakBadge from '@/components/StreakBadge';
import MobileNav from '@/components/MobileNav';
import { soundFX } from '@/lib/sound';
import { calculateStreakFromDates } from '@/lib/streak';
import {
  IconDashboard,
  IconGift,
  IconTrophy,
  IconHelp,
  IconLightning,
  IconLedger,
  IconTrash,
  IconChest,
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
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [search, setSearch] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [redemptionCount, setRedemptionCount] = useState(0);
  const [hasDeepseekKey, setHasDeepseekKey] = useState<boolean | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const { toasts, showToast, dismissToast } = useToast();
  const previousXpBalanceRef = useRef<number | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      const newXp = data.xpBalance ?? 0;

      if (
        previousXpBalanceRef.current !== null &&
        Math.floor(newXp / 100) > Math.floor(previousXpBalanceRef.current / 100)
      ) {
        soundFX.playLevelUp();
        showToast(`Subiste al nivel ${Math.floor(newXp / 100) + 1}`, 'success');
      }

      previousXpBalanceRef.current = newXp;
      setXpBalance(newXp);
      setTasks(data.tasks ?? []);
      setStreak(calculateStreakFromDates((data.tasks ?? []).map((task: Task) => task.completed_at)));
      setRedemptionCount(data.redemptionCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const checkSettings = useCallback(async () => {
    setSettingsError(null);
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('settings request failed');
      const data = await res.json();
      setHasDeepseekKey(Boolean(data.hasDeepseekKey));
    } catch {
      setHasDeepseekKey(null);
      setSettingsError('No se pudo comprobar tu configuración de DeepSeek. Reintentá.');
    }
  }, []);

  useEffect(() => {
    checkSettings();
  }, [checkSettings]);

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

  async function deleteTask(taskId: string) {
    soundFX.playClick();
    setDeletingTask(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast('Tarea borrada', 'success');
        await loadDashboard();
      }
    } catch {
      showToast('Error al borrar la tarea', 'error');
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

      <SettingsModal
        isOpen={showSettings}
        onClose={() => { soundFX.playClick(); setShowSettings(false); }}
        onSaved={() => { loadDashboard(); checkSettings(); }}
      />

      <ConfirmModal
        isOpen={!!deletingTask}
        title="¿Borrar esta tarea?"
        message={`¿Estás seguro de borrar "${deletingTask?.title}"? Esta acción no se puede deshacer.`}
        confirmText="Borrar"
        cancelText="Cancelar"
        onConfirm={() => deletingTask && deleteTask(deletingTask.id)}
        onCancel={() => setDeletingTask(null)}
      />

      <main className="container">
        <Header>
          <button className="nav-link active" aria-label="Inicio">
            <IconDashboard size={16} /> Dashboard
          </button>
          <a href="/rewards" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconGift size={16} /> Recompensas
          </a>
          <a href="/inventory" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconChest size={16} /> Inventario
          </a>
          <a href="/ledger" className="nav-link" onClick={() => soundFX.playClick()}>
            <IconLedger size={16} /> Estado de cuenta
          </a>
          <button className="nav-link" onClick={() => { soundFX.playClick(); setShowAchievements(true); }}>
            <IconTrophy size={16} /> Logros
          </button>
          <button className="nav-link" onClick={() => { soundFX.playClick(); setShowHelp(true); }}>
            <IconHelp size={16} /> Ayuda
          </button>
          <button className="nav-link" onClick={() => { soundFX.playClick(); setShowSettings(true); }}>
            <IconLightning size={16} /> Ajustes
          </button>
        </Header>

        {hasDeepseekKey === false && (
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
            Todavía no configuraste tu clave de DeepSeek.{' '}
            <button
              className="nav-link"
              style={{ display: 'inline', padding: 0, textDecoration: 'underline' }}
              onClick={() => { soundFX.playClick(); setShowSettings(true); }}
            >
              Configúrala en Ajustes
            </button>{' '}
            para poder evaluar el XP de tus tareas.
          </div>
        )}

        {settingsError && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.6rem 0.9rem',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <span>{settingsError}</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="nav-link" style={{ padding: 0, textDecoration: 'underline' }} onClick={checkSettings}>
                Reintentar
              </button>
              <button className="nav-link" style={{ padding: 0, textDecoration: 'underline' }} onClick={() => { soundFX.playClick(); setShowSettings(true); }}>
                Abrir Ajustes
              </button>
            </div>
          </div>
        )}

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
            <span style={{ textAlign: 'right' }}>XP</span>
            <span>Estado</span>
            <span style={{ textAlign: 'right' }}>Acción</span>
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
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button
                        className="btn-action"
                        onClick={() => completeTask(task.id)}
                        disabled={completingId === task.id}
                      >
                        {completingId === task.id ? '...' : 'Completar'}
                      </button>
                      <button
                        className="btn-action"
                        style={{ padding: '0.45rem 0.55rem', display: 'inline-flex', alignItems: 'center' }}
                        onClick={() => { soundFX.playClick(); setDeletingTask(task); }}
                        aria-label="Borrar tarea"
                        title="Borrar tarea"
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
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
