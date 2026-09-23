import styles from '../pages/Settings.module.scss';

interface SchalterZeileProps {
  /** Beschriftung links – zugleich der Name des Schalters für Screenreader. */
  label: string;
  an: boolean;
  onUmschalten: () => void;
}

/**
 * Eine Einstellungszeile mit Schalter rechts (#407). Die ganze Zeile ist EIN Knopf mit
 * `aria-pressed`; der Schalter darin ist reine Anzeige.
 *
 * Stand bis zum 23.09.2026 dreimal fast wortgleich in `pages/Settings.tsx` – und zwar als klickbare
 * Zeile mit einem ZWEITEN Knopf darin, der per `stopPropagation` verhindern musste, dass ein Tipp
 * doppelt schaltet (dann springt der Wert zweimal, also gar nicht). Verschachtelte Bedienelemente
 * sind außerdem für Screenreader ein Ärgernis. Ein einziger Knopf braucht beides nicht; so machen es
 * `LinksManager` und `ItemActionSheet` schon.
 */
export function SchalterZeile({ label, an, onUmschalten }: SchalterZeileProps) {
  return (
    <button
      type="button"
      className={`${styles.setRow} ${styles.tappable}`}
      aria-pressed={an}
      onClick={onUmschalten}
    >
      <span className={styles.setLabel}>{label}</span>
      <span className={`${styles.tog}${an ? ' ' + styles.togOn : ''}`} aria-hidden="true">
        <span className={styles.togThumb} />
      </span>
    </button>
  );
}
