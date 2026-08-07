import { Icon } from './icons';
import styles from '../pages/ChordChart.module.scss';

/**
 * Die Fußzeile der Lied-Anzeige (#314 – vorher inline in `pages/ChordChart.tsx`).
 *
 * Blättern links/rechts, in der Mitte ein Punkt je Lied des Ablaufs und der Ausblick aufs nächste.
 *
 * Die Punkte markieren die gerade SICHTBAREN Lieder – im Querformat können das zwei sein, weil dort
 * zwei Seiten nebeneinander stehen und die Liedgrenze mitten durchs Bild laufen kann.
 */
interface ChartFooterProps {
  /** Ein Punkt je Lied; ab zwei Liedern wird die Reihe überhaupt gezeigt. */
  songCount: number;
  /** Indizes der aktuell sichtbaren Lieder. */
  visibleSongIdx: Set<number>;
  /** Titel des nächsten Lieds – `null` beim letzten. */
  nextSongTitle: string | null;
  atStart: boolean;
  atEnd: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoToSong: (index: number) => void;
}

export function ChartFooter({
  songCount,
  visibleSongIdx,
  nextSongTitle,
  atStart,
  atEnd,
  onPrev,
  onNext,
  onGoToSong,
}: ChartFooterProps) {
  return (
    <div className={styles.ftr}>
      <button
        className={styles.navBtn}
        onClick={onPrev}
        disabled={atStart}
        aria-label="Zurück / vorige Seite"
      >
        <Icon name="chev-left" size={22} stroke={2.4} />
      </button>
      <div className={styles.ftrCenter}>
        {songCount > 1 && (
          <div className={styles.dots}>
            {Array.from({ length: songCount }, (_, i) => (
              <div
                key={i}
                className={`${styles.dot}${visibleSongIdx.has(i) ? ' ' + styles.on : ''}`}
                onClick={() => onGoToSong(i)}
              />
            ))}
          </div>
        )}
        {nextSongTitle ? (
          <div className={styles.ftrInfo}>
            <span className={styles.ftrNext}>Nächstes Lied: {nextSongTitle}</span>
          </div>
        ) : songCount > 1 ? (
          <div className={styles.ftrInfo}>
            <span className={styles.ftrSong}>Letztes Lied</span>
          </div>
        ) : null}
      </div>
      <button
        className={styles.navBtn}
        onClick={onNext}
        disabled={atEnd}
        aria-label="Weiter / nächste Seite"
      >
        <Icon name="chev-right" size={22} stroke={2.4} />
      </button>
    </div>
  );
}
