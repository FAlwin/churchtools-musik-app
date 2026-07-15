import type { SongLibraryEntry } from '@shared/types/index';
import { Icon } from './icons';
import { CenterMessage } from './CenterMessage';
import { SongStatsBar } from './SongStatsBar';
import { useSongFilter } from '../hooks/useSongFilter';
import { fmtPlayDate } from '../utils/songFilter';
import { useCapabilities, useSongLibrary, useSongUsage } from '../hooks/useServices';
import styles from './SongPicker.module.scss';

interface SongPickerProps {
  /** Wird mit dem gewählten (Standard-)Arrangement + Songname aufgerufen. */
  onPick: (arrangementId: number, songName: string) => void;
  /** Deaktiviert die Treffer (z. B. während ein Vorgang läuft). */
  busy?: boolean;
  autoFocus?: boolean;
}

/**
 * Lied-Auswahl beim Hinzufügen/Verknüpfen: zeigt sofort alle Lieder (eine Zeile pro Lied,
 * Standard-Arrangement) – wie die Bibliothek, mit Suche, Sortierung (A–Z/Häufigkeit/Zuletzt) und
 * Zeitfilter. Holt Lieder + Statistik selbst; Statistik nur für Ablauf-Berechtigte.
 */
export function SongPicker({ onPick, busy, autoFocus }: SongPickerProps) {
  const caps = useCapabilities(true);
  const showStats = caps.data?.canViewAgendas ?? false;
  const lib = useSongLibrary(true);
  const usage = useSongUsage(showStats);
  const f = useSongFilter(lib.data ?? [], usage.data, showStats);
  const query = f.q.trim();

  return (
    <div className={styles.wrap}>
      <div className={styles.search}>
        <Icon name="search" size={18} stroke={2} className={styles.searchIcon} />
        <input
          placeholder="Lied oder Autor suchen…"
          value={f.q}
          autoFocus={autoFocus}
          onChange={(e) => f.setQ(e.target.value)}
        />
      </div>
      {showStats && <SongStatsBar {...f} />}

      <div className={styles.results}>
        {lib.isLoading ? (
          <CenterMessage loading text="Lieder werden geladen…" />
        ) : lib.isError ? (
          <CenterMessage icon="⚠️" text="Lieder konnten nicht geladen werden." onRetry={() => lib.refetch()} />
        ) : f.list.length === 0 ? (
          <div className={styles.empty}>
            {query
              ? `Keine Treffer für „${query}"`
              : f.statMode && !f.allRange
                ? 'In diesem Zeitraum wurde kein Lied gespielt.'
                : 'Keine Lieder gefunden.'}
          </div>
        ) : (
          f.list.map((s: SongLibraryEntry) => {
            const st = f.stats.get(s.songId);
            return (
              <button
                key={s.songId}
                className={styles.result}
                disabled={busy}
                onClick={() => onPick(s.arrangementId, s.name)}
              >
                <div className={styles.info}>
                  <span className={styles.songName}>{s.name}</span>
                  {s.author && <span className={styles.sub}>{s.author}</span>}
                  {showStats && f.sort !== 'name' && (
                    <span className={styles.stat}>
                      {usage.isLoading
                        ? 'Statistik lädt…'
                        : f.sort === 'count'
                          ? `${st?.count ?? 0}× gespielt`
                          : `zuletzt ${fmtPlayDate(st?.last ?? null)}`}
                    </span>
                  )}
                </div>
                {s.key && <span className={styles.keyPill}>{s.key}</span>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
