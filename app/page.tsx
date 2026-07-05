'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

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

  return (
    <>
      <main className="home-container">
        <header className="home-header">
          <div className="xp-badge">
            XP: {xpBalance ?? '...'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="home-nav-link" onClick={syncNow} disabled={syncing} style={{ border: 'none', cursor: 'pointer' }}>
              {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
            </button>
            <a href="/rewards" className="home-nav-link">
              Ir a recompensas →
            </a>
          </div>
        </header>

        {syncMessage && <p style={{ color: '#94a3b8' }}>{syncMessage}</p>}

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

        <h2 style={{ marginBottom: '1.5rem', fontWeight: 600 }}>Tus Tareas</h2>
        <ul className="task-list">
          {tasks.length === 0 ? (
             <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No hay tareas aún.</p>
          ) : (
            tasks.map((task) => (
              <li key={task.id} className="task-item">
                <span className="task-title">{task.title}</span>
                <div className="task-meta">
                  <span className="task-xp">+{task.xp_value ?? '?'} XP</span>
                  <span className={`task-status ${task.status === 'completed' || task.status === 'credited' ? 'completed' : ''}`}>
                    {task.status}
                  </span>
                  {task.status !== 'credited' && (
                    <button
                      className="btn-action"
                      onClick={() => completeTask(task.id)}
                      disabled={completingId === task.id}
                      style={{ width: 'auto' }}
                    >
                      {completingId === task.id ? '...' : 'Completar'}
                    </button>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </main>
    </>
  );
}
