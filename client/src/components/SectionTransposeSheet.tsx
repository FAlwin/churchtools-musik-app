import type { ChordProSection } from '@shared/types/index';
import { Sheet } from './Sheet';
import styles from './SectionTransposeSheet.module.scss';

interface SectionTransposeSheetProps {
  sections: ChordProSection[];
  /** Halbton-Versatz je Abschnitts-Index (relativ zur Lied-Tonart). */
  value: Record<number, number>;
  onChange: (index: number, semitones: number) => void;
  onReset: () => void;
  onClose: () => void;
}

const MIN = -11;
const MAX = 11;

/**
 * Einzelne Abschnitte (Vers/Chorus/…) zusätzlich transponieren (Issue #16).
 * Der Versatz gilt relativ zur aktuellen Lied-Tonart und wird pro Lied gespeichert.
 */
export function SectionTransposeSheet({
  sections,
  value,
  onChange,
  onReset,
  onClose,
}: SectionTransposeSheetProps) {
  const anyShift = Object.values(value).some((v) => v !== 0);

  function fmt(v: number): string {
    return v > 0 ? `+${v}` : v < 0 ? `${v}` : '±0';
  }

  return (
    <Sheet title="Abschnitte transponieren" onClose={onClose} cancelLabel="Fertig">
      <div className={styles.hint}>
        Verschiebt einzelne Abschnitte zusätzlich zur Lied-Tonart (z. B. letzter Chorus +1).
      </div>
      <div className={styles.list}>
        {sections.length === 0 ? (
          <div className={styles.empty}>Keine Abschnitte vorhanden.</div>
        ) : (
          sections.map((sec, i) => {
            const v = value[i] ?? 0;
            return (
              <div key={i} className={styles.row}>
                <span className={styles.label}>{sec.label || `Abschnitt ${i + 1}`}</span>
                <div className={styles.stepper}>
                  <button
                    className={styles.step}
                    onClick={() => onChange(i, Math.max(MIN, v - 1))}
                    disabled={v <= MIN}
                    aria-label="Tiefer"
                  >
                    −
                  </button>
                  <span className={`${styles.value}${v !== 0 ? ' ' + styles.valueActive : ''}`}>
                    {fmt(v)}
                  </span>
                  <button
                    className={styles.step}
                    onClick={() => onChange(i, Math.min(MAX, v + 1))}
                    disabled={v >= MAX}
                    aria-label="Höher"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {anyShift && (
        <button className={styles.reset} onClick={onReset}>
          Alle zurücksetzen
        </button>
      )}
    </Sheet>
  );
}
