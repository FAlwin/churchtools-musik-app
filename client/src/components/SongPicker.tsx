import type { SongLibraryEntry, SongSelectTreffer } from '@shared/types/index';
import { CenterMessage } from './CenterMessage';
import { SongStatsBar } from './SongStatsBar';
import { LiedSucheKopf } from './LiedSucheKopf';
import { LiedtextTrefferListe } from './LiedtextTrefferListe';
import { SongSelectTrefferListe } from './SongSelectTrefferListe';
import { LiedtextVorschau } from './LiedtextVorschau';
import { useSongFilter } from '../hooks/useSongFilter';
import { useLiedSuche } from '../hooks/useLiedSuche';
import { statLabel } from '../utils/songFilter';
import { useCapabilities, useSongLibrary, useSongUsage } from '../hooks/useServices';
import styles from './SongPicker.module.scss';

interface SongPickerProps {
  /** Wird mit dem gewählten (Standard-)Arrangement + Songname aufgerufen. */
  onPick: (arrangementId: number, songName: string) => void;
  /**
   * Ein Treffer aus der Quelle „SongSelect" (#378) – der Aufrufer öffnet damit „Neues Lied".
   *
   * **Fehlt dieser Weg, erscheint der Reiter „SongSelect" gar nicht.** In „Lied verknüpfen" ist das so:
   * Dort wird einem vorhandenen Ablaufpunkt ein Lied zugeordnet, ein neu angelegtes Lied müsste in
   * diesen Punkt hineingeschrieben werden – das kann der Anlege-Weg nicht. Ein Reiter dorthin wäre eine
   * Sackgasse.
   */
  onSongSelectTreffer?: (treffer: SongSelectTreffer) => void;
  /** Deaktiviert die Treffer (z. B. während ein Vorgang läuft). */
  busy?: boolean;
  autoFocus?: boolean;
}

/**
 * Lied-Auswahl beim Hinzufügen/Verknüpfen – **mit dem gemeinsamen Suchkopf** (#378).
 *
 * Zeigt zuerst alle Lieder (eine Zeile pro Lied, Standard-Arrangement) wie die Bibliothek, mit Suche,
 * Sortierung (A–Z/Häufigkeit/Zuletzt) und Zeitfilter. Über den Umschalter kommen dieselben zwei weiteren
 * Quellen hinzu wie im Liederheft: Suche im Liedtext und – wo ein Lied entstehen darf – SongSelect.
 *
 * Holt Lieder + Statistik selbst; Statistik nur für Ablauf-Berechtigte.
 */
export function SongPicker({ onPick, onSongSelectTreffer, busy, autoFocus }: SongPickerProps) {
  const caps = useCapabilities(true);
  const showStats = caps.data?.canViewAgendas ?? false;
  const lib = useSongLibrary(true);
  const usage = useSongUsage(showStats);
  const f = useSongFilter(lib.data ?? [], usage.data, showStats, 'name', !usage.isError);
  const query = f.q.trim();
  const suche = useLiedSuche({
    eingabe: f.q,
    canUseCcli: caps.data?.canUseCcli ?? false,
    kannAnlegen: onSongSelectTreffer !== undefined,
  });

  return (
    <div className={styles.wrap}>
      <LiedSucheKopf
        eingabe={f.q}
        onEingabe={f.setQ}
        quelle={suche.quelle}
        quellen={suche.quellen}
        onQuelle={suche.setQuelle}
        onJetztSuchen={suche.jetztSuchen}
        autoFocus={autoFocus}
      />
      {/* Nur bei der Bibliothek: Bei SongSelect sortiert CCLI, und für Liedtext-Treffer gibt es keine
          Spielstatistik. Eine Leiste, die nichts bewirkt, ist schlimmer als keine. */}
      {showStats && suche.inBibliothek && <SongStatsBar {...f} />}

      <div className={styles.results}>
        {suche.quelle === 'liedtext' ? (
          <LiedtextTrefferListe
            begriff={suche.liedtextBegriff}
            songs={lib.data ?? []}
            busy={busy}
            onPick={(s) => onPick(s.arrangementId, s.name)}
          />
        ) : suche.quelle === 'songselect' && onSongSelectTreffer ? (
          <SongSelectTrefferListe
            begriff={suche.songSelectBegriff}
            busy={busy}
            onPick={onSongSelectTreffer}
          />
        ) : lib.isLoading ? (
          <CenterMessage loading text="Lieder werden geladen…" />
        ) : lib.isError ? (
          <CenterMessage
            icon="⚠️"
            text="Lieder konnten nicht geladen werden."
            onRetry={() => lib.refetch()}
          />
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
              /* Zeile + Vorschau (#379) – die Vorschau NEBEN dem Knopf, nicht darin (verschachtelte
                 Buttons sind ungültiges HTML). */
              <div key={s.songId} className={styles.eintrag}>
                <button
                  className={styles.result}
                  disabled={busy}
                  onClick={() => onPick(s.arrangementId, s.name)}
                >
                  <div className={styles.info}>
                    <span className={styles.songName}>{s.name}</span>
                    {s.author && <span className={styles.sub}>{s.author}</span>}
                    {showStats && f.sort !== 'name' && (
                      <span className={styles.stat}>
                        {statLabel(
                          f.sort,
                          st,
                          usage.isError ? 'error' : usage.isLoading ? 'loading' : 'ok',
                        )}
                      </span>
                    )}
                  </div>
                  {s.key && <span className={styles.keyPill}>{s.key}</span>}
                </button>
                <LiedtextVorschau songId={s.songId} songName={s.name} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
