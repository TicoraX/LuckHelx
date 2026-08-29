'use client';

import React, { useState, useEffect, useRef } from 'react';
import { soundFX } from '@/lib/sound';
import { formatTimer, getNextPomodoroState, calculateFocusXp, type PomodoroMode, POMODORO_CONFIG } from '@/lib/pomodoro';
import { formatXp } from '@/lib/xp';

export default function PomodoroWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<PomodoroMode>('work');
  const [timeLeft, setTimeLeft] = useState(POMODORO_CONFIG.workDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [taskTitle, setTaskTitle] = useState('Sesión de concentración');
  const [savingTask, setSavingTask] = useState(false);
  const [showCompletePrompt, setShowCompletePrompt] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode, completedCycles]);

  function handleTimerComplete() {
    setIsRunning(false);
    soundFX.playLevelUp();

    if (mode === 'work') {
      const nextCycles = completedCycles + 1;
      setCompletedCycles(nextCycles);
      setShowCompletePrompt(true);
      const nextState = getNextPomodoroState('work', nextCycles);
      setMode(nextState.nextMode);
      setTimeLeft(nextState.durationSeconds);
    } else {
      const nextState = getNextPomodoroState(mode, completedCycles);
      setMode(nextState.nextMode);
      setTimeLeft(nextState.durationSeconds);
    }
  }

  function togglePlay() {
    soundFX.playClick();
    setIsRunning(!isRunning);
  }

  function resetTimer() {
    soundFX.playClick();
    setIsRunning(false);
    const duration =
      mode === 'work'
        ? POMODORO_CONFIG.workDuration
        : mode === 'short_break'
        ? POMODORO_CONFIG.shortBreakDuration
        : POMODORO_CONFIG.longBreakDuration;
    setTimeLeft(duration);
  }

  async function handleLogTask() {
    setSavingTask(true);
    soundFX.playClick();
    try {
      const earnedXpUnits = calculateFocusXp(25);
      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim() || 'Sesión de concentración Pomodoro (25m)',
          category: 'trabajo',
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        // Complete the task immediately
        await fetch('/api/tasks/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: data.id }),
        });
        soundFX.playTaskComplete();
        setShowCompletePrompt(false);
        if (typeof window !== 'undefined') window.location.reload();
      }
    } catch {
      // error handled
    } finally {
      setSavingTask(false);
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button */}
      <button
        onClick={() => { soundFX.playClick(); setIsOpen(!isOpen); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.65rem',
          fontSize: '0.8rem',
          background: isRunning ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
          border: `1px solid ${isRunning ? 'var(--accent-primary)' : 'var(--border)'}`,
          borderRadius: '4px',
          color: isRunning ? 'var(--accent-primary)' : 'var(--text-main)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        }}
        title="Temporizador Pomodoro"
      >
        <span>{isRunning ? '⏳' : '⏱️'}</span>
        <span>{formatTimer(timeLeft)}</span>
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 100,
            background: 'var(--bg-main)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '1rem',
            width: '240px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {mode === 'work' ? 'Modo Enfoque' : mode === 'short_break' ? 'Descanso Corto' : 'Descanso Largo'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Ciclo {completedCycles}
            </span>
          </div>

          <div
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              textAlign: 'center',
              margin: '0.5rem 0 1rem',
              color: isRunning ? 'var(--accent-primary)' : 'var(--text-main)',
            }}
          >
            {formatTimer(timeLeft)}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button
              className="btn"
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
              onClick={togglePlay}
            >
              {isRunning ? 'Pausar' : 'Iniciar'}
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              onClick={resetTimer}
            >
              Reiniciar
            </button>
          </div>
        </div>
      )}

      {/* Completion Modal Prompt */}
      {showCompletePrompt && (
        <div className="modal-backdrop" onClick={() => setShowCompletePrompt(false)}>
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '420px',
              background: 'var(--bg-main)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '6px',
              padding: '1.25rem',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem' }}>🎉 ¡Sesión de Enfoque Completada!</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Completaste 25 minutos de concentración. Puedes registrar esta actividad como tarea acreditada con bonus de XP.
            </p>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label htmlFor="pomodoro-task-title">Título de la actividad realizada:</label>
              <input
                id="pomodoro-task-title"
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Ej. Estudio de arquitectura"
              />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowCompletePrompt(false)}
                disabled={savingTask}
              >
                Omitir
              </button>
              <button
                className="btn"
                onClick={handleLogTask}
                disabled={savingTask}
              >
                {savingTask ? 'Registrando...' : `Acreditar tarea (+${formatXp(calculateFocusXp(25))} XP)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
