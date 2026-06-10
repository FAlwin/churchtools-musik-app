import type { ReactNode } from 'react';
import styles from './Sheet.module.scss';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Beschriftung des Abbrechen-Buttons (Standard: „Abbrechen"). */
  cancelLabel?: string;
}

/** Von unten einfahrendes Auswahl-Sheet mit Titel und Abbrechen-Button. */
export function Sheet({ title, onClose, children, cancelLabel = 'Abbrechen' }: SheetProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
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
