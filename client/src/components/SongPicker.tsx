import { useState } from 'react';
import type { SongLibraryEntry, SongSelectTreffer } from '@shared/types/index';
import { CenterMessage } from './CenterMessage';
import { SongStatsBar } from './SongStatsBar';
import { LiedSucheKopf } from './LiedSucheKopf';
import { LiedtextTrefferListe } from './LiedtextTrefferListe';
import { SongSelectTrefferListe } from './SongSelectTrefferListe';
import { LiedVorschau } from './LiedVorschau';
import { Icon } from './icons';
import { useSongFilter } from '../hooks/useSongFilter';
import { useLiedSuche } from '../hooks/useLiedSuche';
import { statLabel } from '../utils/songFilter';
import {
  useCapabilities,
  useLiedtextVorschau,
  useSongLibrary,
  useSongSelectLiedtext,
  useSongUsage,
} from '../hooks/useServices';
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
  /** Beschriftung der Hauptaktion in der Vorschau, z. B. „Zum Ablauf hinzufügen". */
  aktionLabel?: string;
  /** Deaktiviert die Treffer (z. B. während ein Vorgang läuft). */
  busy?: boolean;
  autoFocus?: boolean;
}

/** Was gerade in der Vorschau steht – `null` = die Liste ist zu sehen. */
type Vorschau =
  | { art: 'bibliothek'; song: SongLibraryEntry }
  | { art: 'songselect'; treffer: SongSelectTreffer }
  | null;

/**
 * Lied-Auswahl beim Hinzufügen/Verknüpfen – **der Ort des Quellen-Umschalters** (#378, #379).
 *
 * Hier wird ein Lied **eingefügt**, und nur hier gibt es die Reiter **Bibliothek · Liedtexte ·
 * SongSelect**. Im Liederheft stehen sie ausdrücklich **nicht** (Entscheidung Alwin, 14.08.2026): Dort
 * schlägt man nach, und drei Quellen über der Liste wirkten fremd. Dasselbe Muster wie bei WorshipTools,
 * wo die Quellen im Dialog „Lied zum Set hinzufügen" sitzen.
 *
 * **Ein Antippen führt in die Vorschau, nicht direkt zum Einfügen** (#379, Muster ProPresenter): Der
 * Liedtext ist die Entscheidungsgrundlage – bei gleichnamigen Liedern das Einzige, was sie unterscheidet.
 * Für den Alltag im Gottesdienst bleibt der **„+"-Knopf** in der Bibliothekszeile: ein Tipp, sofort
 * eingefügt, ohne Umweg.
 */
export function SongPicker({
  onPick,
  onSongSelectTreffer,
  aktionLabel = 'Zum Ablauf hinzufügen',
  busy,
  autoFocus,
}: SongPickerProps) {
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

  const [vorschau, setVorschau] = useState<Vorschau>(null);

  /**
   * Die zwei Textquellen. **Beide sind abgeschaltet, solange die Liste zu sehen ist** – das ist die
   * eigentliche Vorkehrung: Beim Durchsehen entsteht keine einzige Anfrage, und bei SongSelect (wo offen
   * ist, ob CCLI einen Textabruf verbucht) auch kein Abruf.
   */
  const eigenerText = useLiedtextVorschau(
    vorschau?.art === 'bibliothek' ? vorschau.song.songId : 0,
    vorschau?.art === 'bibliothek',
  );
  const ccliText = useSongSelectLiedtext(
    vorschau?.art === 'songselect' ? vorschau.treffer.songNumber : null,
    vorschau?.art === 'songselect',
  );

  /* ------------------------------------------------------------------ Vorschau */

  if (vorschau?.art === 'bibliothek') {
    const s = vorschau.song;
    return (
      <LiedVorschau
        titel={s.name}
        autoren={s.author}
        kennung={s.key ? `Tonart ${s.key}` : null}
        // Ein Block ohne Beschriftung: Der Index kennt keine Abschnitte, nur den Textanfang.
        teile={eigenerText.data?.vorschau ? [{ label: '', text: eigenerText.data.vorschau }] : []}
        laeuft={eigenerText.isLoading}
        fehler={
          eigenerText.isError
            ? eigenerText.error instanceof Error
              ? eigenerText.error.message
              : 'Der Liedtext konnte nicht geholt werden.'
            : null
        }
        aktion={aktionLabel}
        onAktion={() => onPick(s.arrangementId, s.name)}
        onZurueck={() => setVorschau(null)}
        busy={busy}
      />
    );
  }

  if (vorschau?.art === 'songselect' && onSongSelectTreffer) {
    const t = vorschau.treffer;
    return (
      <LiedVorschau
        titel={ccliText.data?.title ?? t.title}
        autoren={(ccliText.data?.authors ?? t.authors).join(', ') || null}
        kennung={`CCLI-Nr. ${t.songNumber}`}
        teile={ccliText.data?.teile ?? []}
        laeuft={ccliText.isLoading}
        fehler={
          ccliText.isError
            ? ccliText.error instanceof Error
              ? ccliText.error.message
              : 'Der Liedtext konnte nicht von SongSelect geholt werden.'
            : null
        }
        // Pflicht, sobald CCLI ihn mitschickt.
        disclaimer={ccliText.data?.disclaimer}
        aktion="Als neues Lied anlegen …"
        onAktion={() => onSongSelectTreffer(t)}
        onZurueck={() => setVorschau(null)}
        busy={busy}
      />
    );
  }

  /* --------------------------------------------------------------------- Liste */

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
            onPick={(s) => setVorschau({ art: 'bibliothek', song: s })}
          />
        ) : suche.quelle === 'songselect' && onSongSelectTreffer ? (
          <SongSelectTrefferListe
            begriff={suche.songSelectBegriff}
            busy={busy}
            onPick={(treffer) => setVorschau({ art: 'songselect', treffer })}
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
              <div key={s.songId} className={styles.zeile}>
                {/* Antippen führt in die Vorschau (#379) … */}
                <button
                  className={styles.result}
                  disabled={busy}
                  onClick={() => setVorschau({ art: 'bibliothek', song: s })}
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
                {/* … und dieser Knopf bleibt der kurze Weg: sofort einfügen, ohne Vorschau. Im
                    Gottesdienst zählt das (Entscheidung Alwin, 14.08.2026). */}
                <button
                  className={styles.direkt}
                  disabled={busy}
                  onClick={() => onPick(s.arrangementId, s.name)}
                  aria-label={`„${s.name}" ohne Vorschau hinzufügen`}
                  title={aktionLabel}
                >
                  <Icon name="plus" size={19} stroke={2.4} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
