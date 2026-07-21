'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconClose, IconDownload, IconUpload } from './Icons';
import ConfirmModal from './ConfirmModal';
import { soundFX } from '@/lib/sound';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const portalNodeRef = useRef<HTMLDivElement | null>(null);
  const [portalNode, setPortalNode] = useState<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = 'settings-modal-title';

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const node = document.createElement('div');
    document.body.appendChild(node);
    portalNodeRef.current = node;
    setPortalNode(node);
    return () => {
      document.body.removeChild(node);
      portalNodeRef.current = null;
      setPortalNode(null);
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
        onCloseRef.current();
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
  }, [isOpen]);

  if (!isOpen || !portalNode) return null;

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
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo guardar la clave.');
        return;
      }
      if (data?.error) {
        setError(data.error);
        return;
      }
      setKey('');
      onSaved();
      onCloseRef.current();
    } catch {
      setError('No se pudo guardar la clave.');
    } finally {
      setSaving(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      setPendingFile(files[0]);
    }
    // reset input so picking the same file again triggers onChange
    e.target.value = '';
  }

  async function executeRestore() {
    if (!pendingFile) return;
    const fileToRestore = pendingFile;
    setPendingFile(null);
    setRestoring(true);
    setError('');
    try {
      const text = await fileToRestore.text();
      let jsonData: unknown;
      try {
        jsonData = JSON.parse(text);
      } catch {
        setError('El archivo seleccionado no es un JSON válido.');
        setRestoring(false);
        return;
      }

      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.ok) {
        onSaved();
        onCloseRef.current();
      }
    } catch {
      setError('No se pudo restaurar el respaldo.');
    } finally {
      setRestoring(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={() => onCloseRef.current()}>
      <div
        ref={dialogRef}
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '460px' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <ConfirmModal
          isOpen={!!pendingFile}
          title="Restaurar respaldo"
          message="Esta acción reemplazará permanentemente todas tus tareas, XP y recompensas actuales por los datos del archivo de respaldo. No se puede deshacer."
          confirmText="Restaurar y reemplazar datos"
          cancelText="Cancelar"
          onConfirm={executeRestore}
          onCancel={() => setPendingFile(null)}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id={titleId} style={{ fontSize: '1.4rem', margin: 0 }}>Ajustes</h2>
          <button
            onClick={() => onCloseRef.current()}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
            aria-label="Cerrar"
          >
            <IconClose size={20} />
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1rem' }}>
          Clave de DeepSeek. Se guarda solo en este equipo para evaluar el XP de tus tareas.
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

        <button className="btn" onClick={save} disabled={saving || !key.trim()} style={{ width: '100%', marginBottom: '1.5rem' }}>
          {saving ? 'Guardando...' : 'Guardar clave'}
        </button>

        <div style={{ borderTop: '1px dashed var(--divider-dash)', paddingTop: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.4rem 0' }}>Respaldo de datos</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Descarga una copia completa de tus datos o restaura un respaldo previamente guardado.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <a
              href="/api/backup"
              download
              className="btn btn-secondary"
              style={{ width: '100%', textDecoration: 'none' }}
              onClick={() => soundFX.playClick()}
            >
              <IconDownload size={16} /> Descargar respaldo
            </a>

            <input
              type="file"
              ref={fileInputRef}
              accept="application/json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <button
              className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={() => { soundFX.playClick(); fileInputRef.current?.click(); }}
              disabled={restoring}
            >
              <IconUpload size={16} /> {restoring ? 'Restaurando...' : 'Restaurar respaldo'}
            </button>
          </div>
        </div>

        {error && (
          <p style={{ color: '#b3452f', fontSize: '0.85rem', marginTop: '1rem', marginBottom: 0 }}>{error}</p>
        )}
      </div>
    </div>,
    portalNode
  );
}
