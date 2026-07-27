import { useRef, type ReactNode } from 'react';
import { useOverlayKeyboardInset } from '../hooks/useOverlayKeyboardInset';
import styles from './Sheet.module.scss';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Beschriftung des Abbrechen-Buttons (Standard: „Abbrechen"). */
  cancelLabel?: string;
}

/** Zentriertes Dialog-Fenster (Modal) mit Titel und Abbrechen-Button. */
export function Sheet({ title, onClose, children, cancelLabel = 'Abbrechen' }: SheetProps) {
  // Hält den Dialog über der iOS-Tastatur frei und verhindert, dass die Seite verrutscht (#207).
  const overlayRef = useRef<HTMLDivElement>(null);
  useOverlayKeyboardInset(overlayRef);
  return (
    <div ref={overlayRef} className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        {children}
        <button className={styles.cancel} onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
