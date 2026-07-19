'use client';

import React from 'react';
import { IconHelp, IconClose } from './Icons';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <IconHelp size={22} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>¿Cómo funciona?</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.2rem',
            }}
            aria-label="Cerrar ayuda"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'var(--accent-primary)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
              1
            </div>
            <div>
              <strong style={{ fontSize: '1.05rem', display: 'block', marginBottom: '0.2rem' }}>Sincroniza tus Tareas</strong>
              Crea tareas directamente aquí o utiliza tu cuenta de <strong>Google Tasks</strong>. Las tareas se mantendrán sincronizadas en tiempo real.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'var(--accent-primary)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
              2
            </div>
            <div>
              <strong style={{ fontSize: '1.05rem', display: 'block', marginBottom: '0.2rem' }}>Evaluación por IA y Gana XP</strong>
              La inteligencia artificial evalúa la complejidad de cada tarea y te otorga puntos de <strong>XP</strong> proporcionales cuando las completas.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'var(--accent-primary)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
              3
            </div>
            <div>
              <strong style={{ fontSize: '1.05rem', display: 'block', marginBottom: '0.2rem' }}>Abre Cofres y Canjea Recompensas</strong>
              Utiliza tu saldo de XP acumulado para comprar recompensas personalizadas en la <strong>Tienda</strong> o probar tu suerte abriendo <strong>Cofres del Tesoro</strong>.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ background: 'var(--accent-primary)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
              4
            </div>
            <div>
              <strong style={{ fontSize: '1.05rem', display: 'block', marginBottom: '0.2rem' }}>Mantén tu Racha y Sube de Nivel</strong>
              Mantén activa tu <strong>Racha Diaria</strong> y desbloquea <strong>Logros</strong> a medida que subes de nivel.
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} style={{ width: 'auto' }}>
            ¡Entendido!
          </button>
        </div>
      </div>
    </div>
  );
}
