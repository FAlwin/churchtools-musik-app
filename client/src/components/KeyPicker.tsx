import { Sheet } from './Sheet';
import { ALL_KEYS_MAJOR, ALL_KEYS_MINOR } from '../utils/transpose';
import styles from './keyButtons.module.scss';

interface KeyPickerProps {
  currentKey: string;
  /** Ziel-/Originaltonart, auf die zurückgesetzt werden kann. */
  defaultKey: string;
  /** true, wenn aktuell eine abweichende Tonart aktiv ist (Reset anbieten). */
  isCustom: boolean;
  onPick: (key: string) => void;
  onReset: () => void;
  onClose: () => void;
}

/** Bottom-Sheet zur Tonart-Auswahl (Dur/Moll). */
export function KeyPicker({ currentKey, defaultKey, isCustom, onPick, onReset, onClose }: KeyPickerProps) {
  return (
    <Sheet title="Tonart wählen" onClose={onClose}>
      <div className={styles.secLbl}>Dur</div>
      <div className={styles.grid}>
        {ALL_KEYS_MAJOR.map((k) => (
          <button
            key={k}
            className={`${styles.btn}${currentKey === k ? ' ' + styles.active : ''}`}
            onClick={() => onPick(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <div className={styles.secLbl} style={{ marginTop: 12 }}>
        Moll
      </div>
      <div className={styles.grid}>
        {ALL_KEYS_MINOR.map((k) => (
          <button
            key={k}
            className={`${styles.btn}${currentKey === k ? ' ' + styles.active : ''}`}
            onClick={() => onPick(k)}
          >
            {k}
          </button>
        ))}
      </div>
      {isCustom && (
        <button className={styles.reset} onClick={onReset}>
          Zurücksetzen (Original: {defaultKey})
        </button>
      )}
    </Sheet>
  );
}
