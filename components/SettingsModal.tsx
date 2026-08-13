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
  const [offsetSeconds, setOffsetSeconds] = useState('5');
  const [spinDurationMs, setSpinDurationMs] = useState('6500');
  const [savingSound, setSavingSound] = useState(false);
  const [testing, setTesting] = useState(false);
  const [customSound, setCustomSound] = useState(false);
  const [uploading, setUploading] = useState(false);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const calibratorRef = useRef<HTMLAudioElement>(null);
  const [sellRate, setSellRate] = useState('0.4');
  const [keyCostXp, setKeyCostXp] = useState('8');
  const [savingEconomy, setSavingEconomy] = useState(false);

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

  // La config vigente se lee al abrir: los campos tienen que mostrar lo guardado, no el
  // default, o cada visita a Ajustes pisaria la calibracion anterior sin querer.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.openingSound) return;
        setOffsetSeconds(String(data.openingSound.offsetSeconds));
        setSpinDurationMs(String(data.openingSound.spinDurationMs));
        setCustomSound(Boolean(data.openingSound.custom));
        soundFX.configureOpening(Number(data.openingSound.offsetSeconds), Boolean(data.openingSound.custom));
        if (data.saleEconomy) {
          setSellRate(String(data.saleEconomy.sellRate));
          setKeyCostXp(String(data.saleEconomy.keyCostXp));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Se detiene al cerrar el modal: un sample de 20s siguiendo sonando detras de la app
  // cerrada es exactamente lo que nadie quiere.
  useEffect(() => {
    return () => soundFX.stopOpeningSample();
  }, []);

  function testSound() {
    soundFX.playClick();
    if (testing) {
      soundFX.stopOpeningSample();
      setTesting(false);
      return;
    }
    // Prueba con el valor que hay en pantalla, no con el guardado: la idea es escuchar
    // antes de comprometer el cambio.
    soundFX.configureOpening(Number(offsetSeconds), customSound);
    setTesting(true);
    soundFX.startOpeningSample().catch(() => {
      setError('No se encontro la grabacion de apertura.');
      setTesting(false);
    });
  }

  // Calibrar de oido con dos campos numericos es adivinar. Con el reproductor nativo se
  // busca el momento exacto, se para ahi, y el boton copia ese instante al campo: los dos
  // numeros salen de escuchar el archivo, no de estimarlo.
  function markCaseOpens() {
    const at = calibratorRef.current?.currentTime;
    if (at === undefined) return;
    soundFX.playClick();
    setOffsetSeconds(at.toFixed(1));
  }

  function markWeaponShows() {
    const at = calibratorRef.current?.currentTime;
    if (at === undefined) return;
    soundFX.playClick();
    const spin = Math.round((at - Number(offsetSeconds)) * 1000);
    if (spin <= 0) {
      setError('Ese punto esta antes de la apertura: marca primero cuando abre la caja.');
      return;
    }
    setError('');
    setSpinDurationMs(String(spin));
  }

  async function saveSound() {
    setSavingSound(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openingSound: {
            offsetSeconds: Number(offsetSeconds),
            spinDurationMs: Number(spinDurationMs),
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) {
        setError(data?.error ?? 'No se pudo guardar el sonido.');
        return;
      }
      soundFX.configureOpening(Number(offsetSeconds), customSound);
      onSaved();
    } catch {
      setError('No se pudo guardar el sonido.');
    } finally {
      setSavingSound(false);
    }
  }

  async function uploadSound(file: File) {
    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/sounds/opening', { method: 'POST', body });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) {
        setError(data?.error ?? 'No se pudo subir el audio.');
        return;
      }
      setCustomSound(true);
      soundFX.configureOpening(Number(offsetSeconds), true);
    } catch {
      setError('No se pudo subir el audio.');
    } finally {
      setUploading(false);
      if (soundInputRef.current) soundInputRef.current.value = '';
    }
  }

  async function removeSound() {
    soundFX.playClick();
    soundFX.stopOpeningSample();
    setTesting(false);
    await fetch('/api/sounds/opening', { method: 'DELETE' }).catch(() => {});
    setCustomSound(false);
    soundFX.configureOpening(Number(offsetSeconds), false);
  }

  async function saveEconomy() {
    setSavingEconomy(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleEconomy: { sellRate: Number(sellRate), keyCostXp: Number(keyCostXp) },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) {
        setError(data?.error ?? 'No se pudo guardar la economia.');
        return;
      }
      onSaved();
    } catch {
      setError('No se pudo guardar la economia.');
    } finally {
      setSavingEconomy(false);
    }
  }

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

        <div style={{ borderTop: '1px dashed var(--divider-dash)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.4rem 0' }}>Sonido de apertura</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Calza la grabación de <code>public/sounds/case-open.mp3</code> con el giro del
            carrete. El offset es en qué segundo del archivo se abre la caja; la duración,
            cuánto gira hasta frenar.
          </p>

          <audio
            ref={calibratorRef}
            controls
            preload="metadata"
            src={customSound ? '/api/sounds/opening' : '/sounds/case-open.mp3'}
            style={{ width: '100%', marginBottom: '0.6rem' }}
          />

          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', margin: '0 0 0.6rem 0' }}>
            Escuchá la grabación, pará en el momento exacto y marcalo. Los campos se llenan solos.
          </p>

          <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.9rem' }}>
            <button className="btn-action" style={{ flex: 1 }} onClick={markCaseOpens}>
              Acá abre la caja
            </button>
            <button className="btn-action" style={{ flex: 1 }} onClick={markWeaponShows}>
              Acá aparece el arma
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="sound-offset">Offset (s)</label>
              <input
                id="sound-offset"
                type="number"
                min="0"
                max="120"
                step="0.1"
                value={offsetSeconds}
                onChange={(e) => setOffsetSeconds(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="sound-spin">Giro (ms)</label>
              <input
                id="sound-spin"
                type="number"
                min="500"
                max="30000"
                step="100"
                value={spinDurationMs}
                onChange={(e) => setSpinDurationMs(e.target.value)}
              />
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 0.6rem 0' }}>
            {customSound ? 'Usando tu propia grabación.' : 'Usando la grabación incluida.'}
          </p>

          <input
            type="file"
            ref={soundInputRef}
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadSound(file);
            }}
          />

          <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => { soundFX.playClick(); soundInputRef.current?.click(); }}
              disabled={uploading}
            >
              {uploading ? 'Subiendo...' : customSound ? 'Cambiar audio' : 'Subir audio'}
            </button>
            {customSound && (
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={removeSound}>
                Usar la incluida
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={testSound}>
              {testing ? 'Detener' : 'Probar'}
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={saveSound} disabled={savingSound}>
              {savingSound ? 'Guardando...' : 'Guardar sonido'}
            </button>
          </div>
        </div>

        <div style={{ borderTop: '1px dashed var(--divider-dash)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.4rem 0' }}>Economía de cofres</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            La llave se cobra en cada apertura, además del precio de la caja. Es lo que
            impide que abrir cofres baratos y revender los premios genere XP infinito.
            La tasa es cuánto del valor de mercado te devuelve una venta.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="sell-rate">Tasa de venta (0 a 1)</label>
              <input
                id="sell-rate"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={sellRate}
                onChange={(e) => setSellRate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="key-cost">Llave (XP)</label>
              <input
                id="key-cost"
                type="number"
                min="0"
                step="1"
                value={keyCostXp}
                onChange={(e) => setKeyCostXp(e.target.value)}
              />
            </div>
          </div>

          <button className="btn" style={{ width: '100%' }} onClick={saveEconomy} disabled={savingEconomy}>
            {savingEconomy ? 'Guardando...' : 'Guardar economía'}
          </button>
        </div>

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
