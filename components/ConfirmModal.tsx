'use client';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>{title}</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.75rem', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel} style={{ width: 'auto' }}>
            {cancelText}
          </button>
          <button className="btn" onClick={onConfirm} style={{ width: 'auto' }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
