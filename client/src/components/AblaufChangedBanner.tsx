import styles from './AblaufChangedBanner.module.scss';

/**
 * Dezenter Hinweis im geöffneten Liederheft, wenn sich der Ablauf währenddessen geändert hat
 * (Live-Abgleich). BEWUSST kein automatisches Umsortieren: mitten im Spielen dürfen die Seiten
 * nicht unter den Fingern springen – erst „Neu laden" übernimmt die Änderung („Später" blendet
 * den Hinweis aus; beim nächsten Zurückgehen in den Ablauf ist er ohnehin frisch).
 */
export function AblaufChangedBanner({
  onReload,
  onDismiss,
}: {
  onReload: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>Ablauf wurde geändert</span>
      <button className={styles.later} onClick={onDismiss}>
        Später
      </button>
      <button className={styles.load} onClick={onReload}>
        Neu laden
      </button>
    </div>
  );
}
