import styles from './Schalter.module.scss';

/**
 * **Der eine Schalter der App** (#413) – reine Anzeige, kein Bedienelement.
 *
 * Bedient wird der Knopf drumherum: Er trägt `aria-pressed` und die Beschriftung, der Schalter ist
 * `aria-hidden` (Muster aus `SchalterZeile`, #407). Ein zweiter Knopf im Knopf bräuchte ein
 * `stopPropagation`, sonst schaltet ein Tipp doppelt – also gar nicht.
 *
 * Bis zum 24.09.2026 stand das Aussehen dreimal im CSS (Tab „Mehr", Links-Verwaltung, „Uhrzeit
 * ausblenden") – in drei Größen und mit zwei Farben für „aus".
 */
export function Schalter({ an }: { an: boolean }) {
  return (
    <span className={`${styles.schalter}${an ? ' ' + styles.an : ''}`} aria-hidden="true">
      <span className={styles.knopf} />
    </span>
  );
}
