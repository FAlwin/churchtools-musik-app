import { useState } from 'react';
import { type Service, type SongLibraryEntry } from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { Icon } from '../components/icons';
import { NoteTile } from '../components/NoteTile';
import { AddToAgendaSheet } from '../components/AddToAgendaSheet';
import { NewSongSheet } from '../components/NewSongSheet';
import { EditSongSheet } from '../components/EditSongSheet';
import { SongStatsBar } from '../components/SongStatsBar';
import { LiedtextTrefferListe } from '../components/LiedtextTrefferListe';
import { LiedSucheKopf } from '../components/LiedSucheKopf';
import { SucheAngebot } from '../components/SucheAngebot';
import { useLiedSuche } from '../hooks/useLiedSuche';
import { useSongFilter } from '../hooks/useSongFilter';
import { liedAnzahl, statLabel } from '../utils/songFilter';
import type { SongUsageMap } from '../services/churchtoolsApi';
import styles from './AllSongs.module.scss';

interface AllSongsProps {
  songs: SongLibraryEntry[];
  usage?: SongUsageMap;
  usageLoading?: boolean;
  /** Statistik konnte nicht geladen werden (#300) – dann Gedankenstrich statt einer Null. */
  usageError?: boolean;
  showStats?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelect: (entry: SongLibraryEntry) => void;
  /** Wenn true: pro Lied eine „+"-Aktion „Zu Ablauf hinzufügen". */
  canAddToAgenda?: boolean;
  /** Termine zur Auswahl beim Hinzufügen (kommende + vergangene). */
  services?: Service[];
  /** Wenn true: „Neues Lied" unter der Suche (#322) – nur mit dem ChurchTools-Recht. */
  canCreateSong?: boolean;
  /** Öffnet ein Lied unmittelbar nach dem Anlegen (#322). */
  onOpenSong?: (songId: number, arrangementId: number) => void;
  /** Meldung nach dem Speichern/Löschen von Stammdaten (#322, Schritt 11). */
  onToast?: (text: string) => void;
}

/** Durchsuchbare Liste aller Lieder, sortierbar nach Name/Häufigkeit/zuletzt (+ Zeitfilter). */
export function AllSongs({
  songs,
  usage,
  usageLoading,
  usageError,
  showStats = false,
  isLoading,
  isError,
  onRetry,
  onSelect,
  canAddToAgenda = false,
  services = [],
  canCreateSong = false,
  onOpenSong,
  onToast,
}: AllSongsProps) {
  const [addSong, setAddSong] = useState<SongLibraryEntry | null>(null);
  /** Das Blatt „Neues Lied" – hier immer leer; gefüllt wird es nur aus dem Einfüge-Dialog (#378). */
  const [neuesLied, setNeuesLied] = useState(false);
  /** Lied, dessen Stammdaten geändert werden (#322, Schritt 11) – `null` = kein Blatt offen. */
  const [editSong, setEditSong] = useState<SongLibraryEntry | null>(null);
  const f = useSongFilter(songs, usage, showStats, 'name', !usageError);
  const query = f.q.trim();
  /** Anlegen geht nur mit dem Recht – und nur, wenn die Seite das fertige Lied auch öffnen kann. */
  const kannAnlegen = canCreateSong && onOpenSong !== undefined;

  /**
   * **Im Liederheft gibt es nur die Bibliothek und die Liedtexte – kein SongSelect** (Entscheidung
   * Alwin, 14.08.2026, #378). Hier schlägt man ein Lied **nach**; SongSelect gehört dorthin, wo man ein
   * Lied **einfügt** (`SongPicker`). Deshalb `kannAnlegen: false` – damit fehlt die Quelle.
   *
   * Die Regel „das Angebot erscheint ab drei Zeichen, die Treffer gelten nur, solange der Begriff
   * unverändert ist" stand hier bis zum 03.09.2026 als eigener Zustand (`textSuche === query`). Sie liegt
   * jetzt in `useLiedSuche` – einmal, für das Liederheft und den Einfüge-Dialog.
   */
  const suche = useLiedSuche({
    eingabe: f.q,
    canUseCcli: false,
    kannAnlegen: false,
    bibliothekLeer: f.list.length === 0,
  });

  /**
   * „Auch in den Liedtexten suchen" – als **Zuweisung**, nicht als lokale Komponente: Der Knopf erscheint
   * an zwei Stellen (leere Liste und unter den Treffern), und zwei Kopien wären der Anfang, an dem später
   * eine Änderung nur die Hälfte trifft.
   */
  const zuLiedtexten = suche.angebotLiedtexte ? (
    <SucheAngebot
      text={`Auch in den Liedtexten nach „${query}" suchen`}
      onClick={suche.liedtexteSuchen}
    />
  ) : null;

  return (
    <Screen>
      {/* Die Kopfzeile bleibt bewusst leer (Entscheidung Alwin, 13.08.2026): „Neues Lied" stand hier
          zuerst als Symbol – es wirkte fremd, und ein Aktions-Knopf machte diese Leiste 10px höher als
          die von „Termine" und „Mehr", was beim Durchklicken sichtbar sprang. Die Höhe ist inzwischen
          in `NavBar.module.scss` festgenagelt, der Einstieg sitzt trotzdem unten am Listenkopf. */}
      <NavBar title="Lieder" />

      <div className={styles.searchWrap}>
        {/* Dasselbe Suchfeld wie im Einfüge-Dialog – ohne SongSelect-Weg, deshalb tut Enter hier nichts. */}
        <LiedSucheKopf eingabe={f.q} onEingabe={f.setQ} />
        {showStats && <SongStatsBar {...f} />}

        {/**
         * Listenkopf: **Anzahl links, „Neues Lied" rechts – auf einer Höhe** (Wunsch Alwin,
         * 13.08.2026).
         *
         * Die Zeile steht **über dem Scroll-Bereich**, nicht darin. Das hat zwei Gründe: Sie bleibt beim
         * Blättern sichtbar, und sie ist auch dann da, wenn die Suche **keinen** Treffer hat – also
         * genau in dem Moment, in dem ein Lied fehlt und angelegt werden soll. Innerhalb der Liste
         * würde sie mit ihr verschwinden.
         *
         * Die Anzahl zeigt die gefilterte Bibliotheksliste – die Liedtext-Treffer zählen sich selbst.
         */}
        {(f.list.length > 0 || kannAnlegen) && (
          <div className={styles.listHdr}>
            <span className={styles.listCount}>
              {f.list.length > 0 && !isLoading && !isError ? liedAnzahl(f.list.length) : ''}
            </span>
            {kannAnlegen && (
              <button className={styles.newSongBtn} onClick={() => setNeuesLied(true)}>
                <Icon name="plus" size={16} stroke={2.4} />
                Neues Lied
              </button>
            )}
          </div>
        )}
      </div>

      <Scroll onRefresh={onRetry}>
        {isLoading ? (
          <CenterMessage loading text="Lieder werden geladen…" />
        ) : isError ? (
          <CenterMessage icon="⚠️" text="Lieder konnten nicht geladen werden." onRetry={onRetry} />
        ) : f.list.length === 0 ? (
          <>
            <CenterMessage
              icon="🎵"
              text={
                query
                  ? `Keine Treffer für „${query}"`
                  : f.statMode && !f.allRange
                    ? 'In diesem Zeitraum wurde kein Lied gespielt.'
                    : 'Keine Lieder gefunden.'
              }
            />
            {/* Genau hier gehört der Weg zu den Liedtexten hin: Der Titel hat nichts gefunden –
                vielleicht kennt man ihn nicht genau, sondern nur eine Zeile. */}
            {zuLiedtexten}
            {suche.liedtextBegriff !== '' && (
              <div className={styles.group}>
                <LiedtextTrefferListe
                  begriff={suche.liedtextBegriff}
                  songs={songs}
                  onPick={onSelect}
                />
              </div>
            )}
          </>
        ) : (
          <div className={styles.group}>
            {/* Die Anzahl steht oben im festen Listenkopf – auf einer Höhe mit „Neues Lied". */}
            <div className={styles.cardList}>
              {f.list.map((s) => {
                const st = f.stats.get(s.songId);
                return (
                  /* Ohne Vorschau: Im Liederheft schlägt man nach; die Vorschau gehört in den
                     Einfüge-Dialog (#378, Entscheidung Alwin). */
                  <div key={s.songId} className={styles.rowWrap}>
                    <button className={styles.row} onClick={() => onSelect(s)}>
                      <NoteTile />
                      <div className={styles.info}>
                        <div className={styles.name}>{s.name}</div>
                        {s.author && <div className={styles.sub}>{s.author}</div>}
                        {showStats && f.sort !== 'name' && (
                          <span className={styles.stat}>
                            {statLabel(
                              f.sort,
                              st,
                              usageError ? 'error' : usageLoading ? 'loading' : 'ok',
                            )}
                          </span>
                        )}
                      </div>
                      {s.key && <span className={styles.keyPill}>{s.key}</span>}
                      <Icon name="chev-right" size={18} stroke={2.2} className={styles.chev} />
                    </button>
                    {canAddToAgenda && (
                      <button
                        className={styles.addBtn}
                        onClick={() => setAddSong(s)}
                        aria-label={`„${s.name}" zu einem Ablauf hinzufügen`}
                        title="Zu Ablauf hinzufügen"
                      >
                        <Icon name="plus" size={20} stroke={2.4} />
                      </button>
                    )}
                    {/* Stammdaten ändern (#322, Schritt 11) – hier in der Liste, weil man den
                        fehlenden Autor beim Durchsehen bemerkt, nicht erst im geöffneten Blatt.
                        Dasselbe Recht wie das Anlegen. */}
                    {canCreateSong && (
                      <button
                        className={styles.addBtn}
                        onClick={() => setEditSong(s)}
                        aria-label={`Stammdaten von „${s.name}" ändern`}
                        title="Stammdaten ändern"
                      >
                        <Icon name="pencil" size={18} stroke={2.2} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Auch bei Titel-Treffern anbieten: „Gnade" findet zwei Titel, das gesuchte Lied kann
                trotzdem ein anderes sein, das das Wort nur im Text hat. */}
            {zuLiedtexten}
            {suche.liedtextBegriff !== '' && (
              <LiedtextTrefferListe
                begriff={suche.liedtextBegriff}
                songs={songs}
                onPick={onSelect}
              />
            )}
          </div>
        )}
        <div style={{ height: 16 }} />
      </Scroll>

      {addSong && (
        <AddToAgendaSheet song={addSong} services={services} onClose={() => setAddSong(null)} />
      )}

      {/* Stammdaten ändern (#322, Schritt 11). Nach dem Löschen bleibt die Liste stehen – sie lädt
          sich neu, das Lied verschwindet daraus. Kein Ansichtswechsel nötig, anders als im Chart. */}
      {editSong && (
        <EditSongSheet
          songId={editSong.songId}
          songName={editSong.name}
          onSaved={onToast}
          onDeleted={onToast}
          onClose={() => setEditSong(null)}
        />
      )}

      {neuesLied && onOpenSong && (
        <NewSongSheet
          onOpenSong={(songId, arrangementId) => {
            setNeuesLied(false);
            onOpenSong(songId, arrangementId);
          }}
          onClose={() => setNeuesLied(false)}
        />
      )}
    </Screen>
  );
}
