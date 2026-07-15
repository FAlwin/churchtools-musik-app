import { Segment } from './Segment';
import type { SongSort } from '../utils/songFilter';
import styles from './SongStatsBar.module.scss';

interface SongStatsBarProps {
  sort: SongSort;
  setSort: (s: SongSort) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  allRange: boolean;
  /** Zeitfilter nur bei Häufigkeit/Zuletzt zeigen. */
  statMode: boolean;
  className?: string;
}

const SORTS: { id: SongSort; label: string }[] = [
  { id: 'name', label: 'A–Z' },
  { id: 'count', label: 'Häufigkeit' },
  { id: 'recent', label: 'Zuletzt' },
];

/**
 * Sortier-Umschalter (A–Z/Häufigkeit/Zuletzt) + Zeitfilter (Von–Bis / „Alle"). Geteilt von der
 * Lieder-Bibliothek und der Lied-Auswahl beim Hinzufügen/Verknüpfen.
 */
export function SongStatsBar({
  sort,
  setSort,
  from,
  setFrom,
  to,
  setTo,
  allRange,
  statMode,
  className,
}: SongStatsBarProps) {
  return (
    <div className={className}>
      <Segment
        className={styles.segWrap}
        value={sort}
        options={SORTS.map((s) => ({ value: s.id, label: s.label }))}
        onChange={setSort}
      />
      {statMode && (
        <div className={styles.rangeBar}>
          <input
            className={styles.dateInput}
            type="date"
            aria-label="Zeitraum von"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className={styles.rangeDash}>–</span>
          <input
            className={styles.dateInput}
            type="date"
            aria-label="Zeitraum bis"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
          <button
            type="button"
            className={`${styles.allBtn} ${allRange ? styles.allActive : ''}`}
            onClick={() => {
              setFrom('');
              setTo('');
            }}
          >
            Alle
          </button>
        </div>
      )}
    </div>
  );
}
