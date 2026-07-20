'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const portalNodeRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = 'settings-modal-title';

  useEffect(() => {
    const node = document.createElement('div');
    document.body.appendChild(node);
    portalNodeRef.current = node;
    return () => {
      document.body.removeChild(node);
      portalNodeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !portalNodeRef.current) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const bodyChildren = Array.from(document.body.children);
    bodyChildren.forEach((element) => {
      if (element !== portalNodeRef.current) element.setAttribute('inert', '');
    });
    document.body.style.overflow = 'hidden';

    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const focusFirst = () => {
      inputRef.current?.focus();
    };

    focusFirst();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
      );

      if (focusable.length === 0) {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      bodyChildren.forEach((element) => {
        if (element !== portalNodeRef.current) element.removeAttribute('inert');
      });
      document.body.style.overflow = '';
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen || !portalNodeRef.current) return null;

  async function save() {
    if (!key.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deepseekKey: key.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setKey('');
      onSaved();
      onClose();
    } catch {
      setError('No se pudo guardar la clave.');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '460px' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id={titleId} style={{ fontSize: '1.4rem', margin: 0 }}>Clave de DeepSeek</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
            aria-label="Cerrar"
          >
            <IconClose size={20} />
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Se usa para evaluar el XP de tus tareas. Se guarda solo en este equipo.
        </p>

        <div className="form-group">
          <label htmlFor="deepseek-key">Clave de API</label>
          <input
            ref={inputRef}
            id="deepseek-key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            onKeyDown={(e) => { if (e.key === 'Enter' && key.trim() && !saving) save(); }}
          />
        </div>

        {error && (
          <p style={{ color: '#b3452f', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>
        )}

        <button className="btn" onClick={save} disabled={saving || !key.trim()} style={{ width: '100%' }}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>,
    portalNodeRef.current
  );
}
