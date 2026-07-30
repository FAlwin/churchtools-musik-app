/**
 * Aussehen-Menü der Chart-Ansicht (#198 – vorher inline in `pages/ChordChart.tsx`).
 *
 * Gilt für das aktive Lied: Schriftgröße und Spaltenzahl. Bewusst ohne Kenntnis der
 * Einstellungs-Struktur – die Komponente meldet nur „so groß" bzw. „so viele Spalten".
 */
import { stepFontSize } from '../utils/chartSettings';
import styles from '../pages/ChordChart.module.scss';

interface ChartAppearanceMenuProps {
  fontSize: number;
  cols: 1 | 2;
  onFontSize: (next: number) => void;
  onCols: (next: 1 | 2) => void;
  onClose: () => void;
}

export function ChartAppearanceMenu({
  fontSize,
  cols,
  onFontSize,
  onCols,
  onClose,
}: ChartAppearanceMenuProps) {
  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div className={styles.appMenu}>
        <div className={styles.menuLbl}>Schriftgröße</div>
        <div className={styles.appRow}>
          <button className={styles.stepBtn} onClick={() => onFontSize(stepFontSize(fontSize, -1))}>
            A−
          </button>
          <span className={styles.stepValue}>{fontSize}</span>
          <button className={styles.stepBtn} onClick={() => onFontSize(stepFontSize(fontSize, 1))}>
            A+
          </button>
        </div>

        <div className={styles.menuLbl}>Spalten</div>
        <div className={styles.segGroup}>
          <button
            className={`${styles.segBtn}${cols === 1 ? ' ' + styles.on : ''}`}
            onClick={() => onCols(1)}
          >
            1 Spalte
          </button>
          <button
            className={`${styles.segBtn}${cols === 2 ? ' ' + styles.on : ''}`}
            onClick={() => onCols(2)}
          >
            2 Spalten
          </button>
        </div>
      </div>
    </>
  );
}
