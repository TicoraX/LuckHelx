'use client';

import type React from 'react';
import { useId, useLayoutEffect, useRef } from 'react';

interface ModalProps {
  /** Cierra el modal: click en el fondo y, salvo que se pase `onEscape`, la tecla Escape. */
  onClose: () => void;
  /** Escape con otro significado (por ejemplo, saltear una animacion antes de cerrar). */
  onEscape?: () => void;
  /** false: el click en el fondo no cierra (una batalla en curso no se corta por un click perdido). */
  closeOnBackdrop?: boolean;
  labelledBy?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * `<dialog>` nativo abierto con showModal(): el navegador atrapa el foco, vuelve inerte el
 * resto de la pagina, cierra con Escape (evento `cancel`) y devuelve el foco al cerrar. Antes
 * cada modal era un <div> y solo Ajustes reimplementaba eso a mano.
 *
 * El <dialog> ocupa toda la pantalla y hace de fondo (`.modal-backdrop`), asi que un click
 * cuyo target es el propio <dialog> cayo fuera de la caja (`.modal-dialog`) y cierra.
 */
export default function Modal({
  onClose,
  onEscape,
  closeOnBackdrop = true,
  labelledBy,
  className,
  style,
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const fallbackTitleId = useId();
  const closeRef = useRef(onClose);
  const escapeRef = useRef(onEscape);
  closeRef.current = onClose;
  escapeRef.current = onEscape;

  // Layout effect: abrir antes del primer pintado, sin un frame con el <dialog> cerrado.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Sin labelledBy, el primer titulo del contenido nombra al dialogo: un <dialog> sin nombre
    // se anuncia solo como "dialogo" y no dice cual.
    if (!labelledBy) {
      const heading = dialog.querySelector('h1, h2, h3');
      if (heading) {
        if (!heading.id) heading.id = fallbackTitleId;
        dialog.setAttribute('aria-labelledby', heading.id);
      }
    }
    dialog.showModal();
    // showModal no bloquea el scroll del documento de fondo.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      dialog.close();
    };
  }, [labelledBy, fallbackTitleId]);

  return (
    <dialog
      ref={ref}
      className={`modal-backdrop${className ? ` ${className}` : ''}`}
      aria-labelledby={labelledBy}
      style={style}
      onCancel={(e) => {
        // El padre decide si se desmonta; sin preventDefault el navegador lo cerraria solo.
        e.preventDefault();
        (escapeRef.current ?? closeRef.current)();
      }}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) closeRef.current();
      }}
    >
      {children}
    </dialog>
  );
}
