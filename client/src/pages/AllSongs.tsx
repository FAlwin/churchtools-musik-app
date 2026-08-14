import { useState } from 'react';
import {
  LIEDTEXT_SUCHE_MIN_ZEICHEN,
  type Service,
  type SongLibraryEntry,
  type SongSelectTreffer,
} from '@shared/types/index';
import { Screen, Scroll } from '../components/Screen';
import { NavBar } from '../components/NavBar';
import { CenterMessage } from '../components/CenterMessage';
import { Icon } from '../components/icons';
import { NoteTile } from '../components/NoteTile';
import { AddToAgendaSheet } from '../components/AddToAgendaSheet';
import { NewSongSheet } from '../components/NewSongSheet';
import { EditSongSheet } from '../components/EditSongSheet';
import { SongStatsBar } from '../components/SongStatsBar';
import { LiedSucheKopf } from '../components/LiedSucheKopf';
import { LiedtextTrefferListe } from '../components/LiedtextTrefferListe';
import { SongSelectTrefferListe } from '../components/SongSelectTrefferListe';
import { useSongFilter } from '../hooks/useSongFilter';
import { useLiedSuche } from '../hooks/useLiedSuche';
import { useCapabilities } from '../hooks/useServices';
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
  /**
   * Das Blatt „Neues Lied" – `null` = zu. Offen trägt es **optional den SongSelect-Treffer**, mit dem es
   * geöffnet wurde (#378): Aus der Quelle „SongSelect" heraus ist das Formular dann schon gefüllt.
   */
  const [neuesLied, setNeuesLied] = useState<{ treffer?: SongSelectTreffer } | null>(null);
  /** Lied, dessen Stammdaten geändert werden (#322, Schritt 11) – `null` = kein Blatt offen. */
  const [editSong, setEditSong] = useState<SongLibraryEntry | null>(null);
  const f = useSongFilter(songs, usage, showStats, 'name', !usageError);
  const query = f.q.trim();
  /** Anlegen geht nur mit dem Recht – und nur, wenn die Seite das fertige Lied auch öffnen kann. */
  const kannAnlegen = canCreateSong && onOpenSong !== undefined;
  const caps = useCapabilities(true);
  const suche = useLiedSuche({
    eingabe: f.q,
    canUseCcli: caps.data?.canUseCcli ?? false,
    kannAnlegen,
  });

  /**
   * Abkürzung zum Reiter „Liedtexte" – **kein zweiter Suchweg**, nur ein Umschalten (#378).
   *
   * Der Reiter oben ist der eigentliche Weg. Dieser Knopf steht dort, wo der Wunsch entsteht: unter einer
   * Trefferliste, die nicht das Gesuchte enthält. Er ruft nur `setQuelle` – die Suche selbst liegt an
   * einer Stelle, sonst wäre es die nächste Dopplung.
   *
   * Als **Zuweisung**, nicht als lokale Komponente: Er erscheint an zwei Stellen (leere Liste und unter
   * den Treffern), und zwei Kopien desselben JSX wären genau der Anfang, an dem später eine Änderung nur
   * die Hälfte trifft.
   */
  const zuLiedtexten =
    query.length >= LIEDTEXT_SUCHE_MIN_ZEICHEN ? (
      <button className={styles.textSucheBtn} onClick={() => suche.setQuelle('liedtext')}>
        <Icon name="search" size={15} stroke={2.2} />
        Auch in den Liedtexten nach „{query}" suchen
      </button>
    ) : null;

  return (
    <Screen>
      {/* Die Kopfzeile bleibt bewusst leer (Entscheidung Alwin, 13.08.2026): „Neues Lied" stand hier
          zuerst als Symbol – es wirkte fremd, und ein Aktions-Knopf machte diese Leiste 10px höher als
          die von „Termine" und „Mehr", was beim Durchklicken sichtbar sprang. Die Höhe ist inzwischen
          in `NavBar.module.scss` festgenagelt, der Einstieg sitzt trotzdem unten am Listenkopf. */}
      <NavBar title="Lieder" />

      <div className={styles.searchWrap}>
        <LiedSucheKopf
          eingabe={f.q}
          onEingabe={f.setQ}
          quelle={suche.quelle}
          quellen={suche.quellen}
          onQuelle={suche.setQuelle}
          onJetztSuchen={suche.jetztSuchen}
        />
        {/* Nur bei der Bibliothek: Bei SongSelect sortiert CCLI, und für Liedtext-Treffer gibt es keine
            Spielstatistik. Eine Leiste, die nichts bewirkt, ist schlimmer als keine. */}
        {showStats && suche.inBibliothek && <SongStatsBar {...f} />}

        {/**
         * Listenkopf: **Anzahl links, „Neues Lied" rechts – auf einer Höhe** (Wunsch Alwin,
         * 13.08.2026).
         *
         * Die Zeile steht **über dem Scroll-Bereich**, nicht darin. Das hat zwei Gründe: Sie bleibt beim
         * Blättern sichtbar, und sie ist auch dann da, wenn die Suche **keinen** Treffer hat – also
         * genau in dem Moment, in dem ein Lied fehlt und angelegt werden soll. Innerhalb der Liste
         * würde sie mit ihr verschwinden.
         *
         * **Die Anzahl gilt nur für die Bibliothek** (#378): Bei den anderen Quellen zählt die
         * Trefferliste selbst, und „49 Lieder" über zwei SongSelect-Treffern wäre schlicht falsch.
         * „Neues Lied" bleibt in jeder Quelle stehen – wie das „+ Erstelle" bei WorshipTools.
         */}
        {(f.list.length > 0 || kannAnlegen) && (
          <div className={styles.listHdr}>
            <span className={styles.listCount}>
              {suche.inBibliothek && f.list.length > 0 && !isLoading && !isError
                ? liedAnzahl(f.list.length)
                : ''}
            </span>
            {kannAnlegen && (
              <button className={styles.newSongBtn} onClick={() => setNeuesLied({})}>
                <Icon name="plus" size={16} stroke={2.4} />
                Neues Lied
              </button>
            )}
          </div>
        )}
      </div>

      <Scroll onRefresh={onRetry}>
        {suche.quelle === 'liedtext' ? (
          <div className={styles.group}>
            <LiedtextTrefferListe begriff={suche.liedtextBegriff} songs={songs} onPick={onSelect} />
          </div>
        ) : suche.quelle === 'songselect' ? (
          <div className={styles.group}>
            {/* Ein Treffer führt ins Anlege-Formular, nicht direkt nach ChurchTools: Die Kategorie ist
                Pflicht und wird bewusst nicht vorbelegt (#378). */}
            <SongSelectTrefferListe
              begriff={suche.songSelectBegriff}
              onPick={(treffer) => setNeuesLied({ treffer })}
            />
          </div>
        ) : isLoading ? (
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
          </>
        ) : (
          <div className={styles.group}>
            {/* Die Anzahl steht jetzt oben im festen Listenkopf – auf einer Höhe mit „Neues Lied". */}
            <div className={styles.cardList}>
              {f.list.map((s) => {
                const st = f.stats.get(s.songId);
                return (
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
          startTreffer={neuesLied.treffer}
          onOpenSong={(songId, arrangementId) => {
            setNeuesLied(null);
            onOpenSong(songId, arrangementId);
          }}
          onClose={() => setNeuesLied(null)}
        />
      )}
    </Screen>
  );
}
