import { useState } from 'react';
import type { SongLibraryEntry, SongSelectTreffer } from '@shared/types/index';
import { CenterMessage } from './CenterMessage';
import { SongStatsBar } from './SongStatsBar';
import { LiedSucheKopf } from './LiedSucheKopf';
import { SucheAngebot } from './SucheAngebot';
import { LiedtextTrefferListe } from './LiedtextTrefferListe';
import { SongSelectTrefferListe } from './SongSelectTrefferListe';
import { LiedVorschau } from './LiedVorschau';
import { LiedZeile } from './LiedZeile';
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
   * **Fehlt dieser Weg, gibt es SongSelect hier gar nicht** – weder das Angebot noch die automatische
   * Suche. In „Lied verknüpfen" ist das so: Dort wird einem vorhandenen Ablaufpunkt ein Lied zugeordnet,
   * ein neu angelegtes Lied müsste in diesen Punkt hineingeschrieben werden – das kann der Anlege-Weg
   * nicht. Ein Angebot dorthin wäre eine Sackgasse.
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
 * Lied-Auswahl beim Hinzufügen/Verknüpfen (#378, #379).
 *
 * **Ein Suchfeld, die Bibliothek zuerst.** Darunter stehen die anderen Quellen als **Angebote**: „Auch in
 * den Liedtexten nach … suchen" und – nur wo aus einem Treffer ein Lied werden kann – „Bei SongSelect
 * nach … suchen". Findet die Bibliothek nichts, fragt SongSelect von selbst. Die Regeln dazu liegen in
 * `useLiedSuche`.
 *
 * Bis zum 03.09.2026 stand hier ein Umschalter „Bibliothek · Liedtexte · SongSelect" über der Liste.
 * Alwins Rückmeldung: Das verlangt die Entscheidung, WO gesucht wird, vor dem Tippen – man kann sie aber
 * erst nach dem Ergebnis treffen. Deshalb jetzt die Reihenfolge, in der man tatsächlich sucht.
 *
 * **Jede Zeile hat zwei Knöpfe** (#379 und Alwins Rückmeldung vom 04.09.2026): Die Zeile selbst – mit
 * dem Auge – öffnet die Vorschau; der Liedtext ist die Entscheidungsgrundlage, bei gleichnamigen Liedern
 * das Einzige, was sie unterscheidet. Das **Plus** fügt sofort ein (bei SongSelect: öffnet „Neues Lied"
 * vorbelegt). Bibliothek, SongSelect und Liedtexte nutzen dafür **dieselbe** `LiedZeile` – vorher sahen
 * die drei verschieden aus und verhielten sich verschieden.
 *
 * **Eine Liste, drei Gruppen:** eigene Lieder oben, darunter SongSelect (mit Überschrift), am Ende die
 * Liedtexte. Die Angebote dazwischen sind dezente Zeilen, keine Knöpfe.
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
    // „Leer" heißt: Die Liste steht und hat zu diesem Begriff nichts. Während des Ladens oder bei
    // einem Fehler ist sie nicht leer, sondern unbekannt – dann darf SongSelect nicht von selbst starten.
    bibliothekLeer: !lib.isLoading && !lib.isError && query !== '' && f.list.length === 0,
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
        onSongSelectSuchen={suche.songSelectMoeglich ? suche.songSelectSuchen : undefined}
        autoFocus={autoFocus}
      />
      {/* Die Sortierleiste gilt der Bibliothek – und die steht immer oben. */}
      {showStats && <SongStatsBar {...f} />}

      <div className={styles.results}>
        {lib.isLoading ? (
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
            const unter = [s.author, s.ccli ? `Nr. ${s.ccli}` : null].filter(Boolean).join(' · ');
            return (
              <LiedZeile
                key={s.songId}
                titel={s.name}
                unterzeile={unter || null}
                zusatz={
                  <>
                    {showStats && f.sort !== 'name' && (
                      <span className={styles.stat}>
                        {statLabel(
                          f.sort,
                          st,
                          usage.isError ? 'error' : usage.isLoading ? 'loading' : 'ok',
                        )}
                      </span>
                    )}
                    {s.key && <span className={styles.keyPill}>{s.key}</span>}
                  </>
                }
                onZeile={() => setVorschau({ art: 'bibliothek', song: s })}
                aktion={{ label: aktionLabel, onClick: () => onPick(s.arrangementId, s.name) }}
                disabled={busy}
              />
            );
          })
        )}

        {/**
         * Die anderen Quellen – **unter** der Bibliothek, egal ob sie etwas gefunden hat. Erst SongSelect
         * (Alwins Satz: „Titel oder Nummer eingeben, und das Lied erscheint" – das ist der Hauptweg für
         * ein neues Lied), am Ende die Liedtexte als Nebenweg. Solange die Bibliothek lädt oder
         * gescheitert ist, gibt es nichts anzubieten: Man wüsste nicht, ob das Gesuchte nicht doch da ist.
         */}
        {!lib.isLoading && !lib.isError && (
          <>
            {suche.angebotSongSelect && (
              <SucheAngebot
                text={`Bei SongSelect nach „${query}" suchen`}
                onClick={suche.songSelectSuchen}
              />
            )}
            {suche.songSelectBegriff !== '' && onSongSelectTreffer && (
              <SongSelectTrefferListe
                begriff={suche.songSelectBegriff}
                busy={busy}
                onVorschau={(treffer) => setVorschau({ art: 'songselect', treffer })}
                onEinfuegen={onSongSelectTreffer}
              />
            )}
            {suche.angebotLiedtexte && (
              <SucheAngebot
                text={`Auch in den Liedtexten nach „${query}" suchen`}
                onClick={suche.liedtexteSuchen}
              />
            )}
            {suche.liedtextBegriff !== '' && (
              <LiedtextTrefferListe
                begriff={suche.liedtextBegriff}
                songs={lib.data ?? []}
                busy={busy}
                onPick={(s) => setVorschau({ art: 'bibliothek', song: s })}
                onEinfuegen={{
                  label: aktionLabel,
                  onClick: (s) => onPick(s.arrangementId, s.name),
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
