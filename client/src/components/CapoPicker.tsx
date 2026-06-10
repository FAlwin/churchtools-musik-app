import { Sheet } from './Sheet';
import styles from './keyButtons.module.scss';

interface CapoPickerProps {
  capo: number;
  /** Tonart, in der gegriffen wird (klingende Tonart minus Kapo). */
  shapeKey: string;
  /** Tatsächlich klingende Tonart. */
  soundingKey: string;
  onPick: (capo: number) => void;
  onClose: () => void;
}

/** Bottom-Sheet zur Kapo-Auswahl mit „Griff klingt wie"-Hinweis. */
export function CapoPicker({ capo, shapeKey, soundingKey, onPick, onClose }: CapoPickerProps) {
  return (
    <Sheet title="Kapo" onClose={onClose}>
      <div className={styles.capoHint}>
        {capo > 0 ? (
          <>
            <span style={{ opacity: 0.7 }}>Griff: </span>
            <strong className={styles.capoShape}>{shapeKey}</strong>
            <span style={{ opacity: 0.7 }}> · klingt wie </span>
            <strong className={styles.capoSounds}>{soundingKey}</strong>
          </>
        ) : (
          <span style={{ opacity: 0.6 }}>Kein Kapo gesetzt</span>
        )}
      </div>
      <div className={styles.capoGrid}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
          <button
            key={c}
            className={`${styles.btn}${capo === c ? ' ' + styles.active : ''}`}
            onClick={() => onPick(c)}
          >
            {c === 0 ? '–' : c}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
