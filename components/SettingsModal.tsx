'use client';

import React, { useState } from 'react';
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

  if (!isOpen) return null;

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Clave de DeepSeek</h2>
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
    </div>
  );
}
