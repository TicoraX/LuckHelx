'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { createBrowserClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import FadeIn from '@/components/FadeIn';
import AnimatedNumber from '@/components/AnimatedNumber';

interface Task {
  id: string;
  title: string;
  xp_value: number | null;
  status: string;
}

export default function Home() {
  const [xpBalance, setXpBalance] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  // Created once via lazy useState initializer — calling createBrowserClient() directly in the
  // component body would build a new client every render, and using it as a useEffect dependency
  // would then re-trigger that effect forever.
  const [supabase] = useState(() => createBrowserClient());
  const router = useRouter();

  const loadDashboard = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('xp_balance').eq('id', user.id).single();
    setXpBalance(profile?.xp_balance ?? 0);

    const { data: taskRows } = await supabase
      .from('tasks')
      .select('id, title, xp_value, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTasks(taskRows ?? []);
  }, [supabase, router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function syncNow() {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/sync-now', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setSyncMessage(`Error: ${data.error}`);
      } else {
        setSyncMessage('Sincronizado.');
        await loadDashboard();
      }
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(''), 4000);
    }
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, description: newDescription }),
      });
      const data = await res.json();
      if (data.error) {
        setSyncMessage(`Error: ${data.error}`);
      } else {
        setNewTitle('');
        setNewDescription('');
        await loadDashboard();
      }
    } finally {
      setCreating(false);
      setTimeout(() => setSyncMessage(''), 4000);
    }
  }

  async function completeTask(taskId: string) {
    setCompletingId(taskId);
    try {
      const res = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (data.error) {
        setSyncMessage(`Error: ${data.error}`);
        setTimeout(() => setSyncMessage(''), 4000);
      } else {
        await loadDashboard();
      }
    } finally {
      setCompletingId(null);
    }
  }

  const activeTasks = tasks.filter((t) => t.status !== 'credited');

  return (
    <FadeIn>
      <main className="home-container">
        <Header
          left={
            <div className="xp-badge">
              XP: <AnimatedNumber value={xpBalance ?? 0} />
            </div>
          }
        >
          <button className="nav-link" onClick={syncNow} disabled={syncing}>
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
          <a href="/rewards" className="nav-link">
            Ir a recompensas →
          </a>
          <button className="nav-link" onClick={signOut}>
            Cerrar sesión
          </button>
        </Header>

        {syncMessage && <p style={{ color: 'var(--text-muted)' }}>{syncMessage}</p>}

        <div className="task-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nueva tarea (ej. lavar los platos)"
          />
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Descripción (opcional)"
          />
          <button className="btn" onClick={createTask} disabled={creating || !newTitle.trim()}>
            {creating ? 'Creando...' : 'Crear tarea'}
          </button>
        </div>

        <h2 style={{ marginBottom: '1.5rem' }}>Tus Tareas</h2>
        {activeTasks.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay tareas aún.</p>
        ) : (
          <ul className="task-list">
            <AnimatePresence initial={false}>
              {activeTasks.map((task) => (
                <motion.li
                  key={task.id}
                  className="task-item"
                  layout
                  exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="task-title">{task.title}</span>
                  <div className="task-meta">
                    <span className="task-xp">+{task.xp_value ?? '?'} XP</span>
                    <span className="task-status">{task.status}</span>
                    <button
                      className="btn-action"
                      onClick={() => completeTask(task.id)}
                      disabled={completingId === task.id}
                      style={{ width: 'auto' }}
                    >
                      {completingId === task.id ? '...' : 'Completar'}
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </main>
    </FadeIn>
  );
}
