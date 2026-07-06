import { useSwUpdate } from '../hooks/useSwUpdate';
import styles from './UpdateBanner.module.scss';

/**
 * Dezenter Hinweis über der Tab-Leiste, sobald eine neue App-Version bereitliegt.
 * „Jetzt laden" übernimmt sie sofort (kurzes Neuladen), „Später" blendet den Hinweis aus –
 * es wird nie ungefragt neu geladen (wichtig im Gottesdienst).
 */
export function UpdateBanner() {
  const { updateReady, applyUpdate, dismiss } = useSwUpdate();
  if (!updateReady) return null;
  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>Neue Version verfügbar</span>
      <button className={styles.later} onClick={dismiss}>
        Später
      </button>
      <button className={styles.load} onClick={applyUpdate}>
        Jetzt laden
      </button>
    </div>
  );
}
