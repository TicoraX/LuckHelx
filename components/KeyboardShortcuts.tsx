'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputActive = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      // Global shortcut: Ctrl+N or Cmd+N to create task (focus task input)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const taskInput = document.querySelector('input[aria-label="Título de la nueva tarea"]') as HTMLInputElement | null;
        if (taskInput) {
          taskInput.focus();
        } else {
          router.push('/');
        }
        return;
      }

      // If user is currently typing in an input, do not trigger navigation numbers
      if (isInputActive) return;

      // Navigation shortcuts: 1-4
      if (e.key === '1') {
        router.push('/');
      } else if (e.key === '2') {
        router.push('/rewards');
      } else if (e.key === '3') {
        router.push('/inventory');
      } else if (e.key === '4') {
        router.push('/ledger');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return null;
}
