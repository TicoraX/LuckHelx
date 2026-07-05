'use client';

import { useEffect, useState } from 'react';
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
  // Created once via lazy useState initializer — calling createBrowserClient() directly in the
  // component body would build a new client every render, and using it as a useEffect dependency
  // would then re-trigger that effect forever.
  const [supabase] = useState(() => createBrowserClient());
  const router = useRouter();

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, [supabase, router]);

  return (
    <>
      <main className="home-container">
        <header className="home-header">
          <div className="xp-badge">
            XP: {xpBalance ?? '...'}
          </div>
          <a href="/rewards" className="home-nav-link">
            Ir a recompensas →
          </a>
        </header>
        
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
                  <span className={`task-status ${task.status === 'completed' ? 'completed' : ''}`}>
                    {task.status}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </main>
    </>
  );
}
