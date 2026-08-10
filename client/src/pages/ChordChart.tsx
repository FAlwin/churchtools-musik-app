import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { Screen } from '../components/Screen';
import { ChartHeader } from '../components/ChartHeader';
import { ChartFooter } from '../components/ChartFooter';
import { ChartOverlays } from '../components/ChartOverlays';
import { TempoMenu } from '../components/TempoMenu';
import { ImportPreviewBar, ViewingBanner } from '../components/ChartTeamNotesBars';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ChordEditor } from '../components/ChordEditor';
import { PageDeck } from '../components/PageDeck';
import { useSongSettings } from '../hooks/useSongSettings';
import { useLandscape } from '../hooks/useLandscape';
import { Coachmarks } from '../components/Coachmarks';
import {
  CHART_STEPS,
  HINT_VOLLBILD,
  TOUR_CHART,
  isTourDone,
  markTourDone,
} from '../utils/onboarding';
import { VIEW_NS } from '../services/teamNotes';
import {
  drawKeyForPage,
  pageLabelFor,
  viewKeyForPage,
  zoomKeyBaseForPage,
} from '../utils/chartPageKeys';
import { SharersSheet } from '../components/SharersSheet';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { deriveActiveSongView } from '../utils/activeSongView';
import { generateChordPdf } from '../utils/chordPdf';
import { pdfOptionsForSong } from '../utils/chartPdfOptions';
import { sharePdf } from '../utils/sharePdf';
import { DEFAULT_SETTINGS } from '../utils/chartSettings';
import { useTeamNotesImport } from '../hooks/useTeamNotesImport';
import { useChartNavigation } from '../hooks/useChartNavigation';
import { useChartEditor } from '../hooks/useChartEditor';
import { useAppLogo } from '../hooks/useAppLogo';
import { useChartStream } from '../hooks/useChartStream';
import { useChartSync, useResyncAfterEditor } from '../hooks/useChartSync';
import { useMetronome, type KlickModus } from '../hooks/useMetronome';
import { taktRaster } from '../utils/metronome';
import { arrangementMigrationAnwenden } from '../utils/arrangementMigration';
import { setArrangementTempo } from '../services/churchtoolsApi';
import { useSetlistPages } from '../hooks/useSetlistPages';
import type { DrawTool } from '../types/index';
import styles from './ChordChart.module.scss';

/**
 * Vier Anmerkungsfarben (ECG-Palette): Rot, Blau, Grün (Türkis), Orange.
 * Modul-Konstante, damit die Liste nicht bei jedem Render neu entsteht – sie geht als Prop an
 * `PageDeck` weiter und würde dort sonst bei jedem Render als „geändert" gelten.
 */
const DRAW_COLORS = ['#bb2946', '#0062ac', '#1bb0a2', '#fb8f00'];

interface ChordChartProps {
  songs: SetlistSong[];
  startIndex: number;
  onBack: () => void;
  onReload?: () => void;
  /** Darf der Nutzer den ChordPro-Text bearbeiten? (blendet Editor-Funktionen aus) */
  canEditSong?: boolean;
  /** Darf Team-Notizen nutzen (eigene teilen + geteilte anderer ansehen)? */
  canUseGlobalNotes?: boolean;
}

/**
 * Lied-Anzeige als durchgehender PDF-Seitenstrom über den ganzen Ablauf.
 * Hochformat: 1 Seite. Querformat: 2 Seiten nebeneinander (auch über Liedgrenzen).
 * Die angetippte Hälfte ist „aktiv" und bestimmt, worauf Kopfzeile/Menüs wirken.
 */
export function ChordChart({
  songs,
  startIndex,
  onBack,
  onReload,
  canEditSong = false,
  canUseGlobalNotes = false,
}: ChordChartProps) {
  // Anzeige-Einstellungen aller Lieder – Halten und Speichern liegt in useSongSettings (#198).
  const { settings, updateSetting, selectVersion, reloadSettings } = useSongSettings(songs);

  /**
   * Bestandsnotizen dem geltenden Arrangement zuschlagen (#320).
   *
   * **In einem `useMemo` und nicht in einem `useEffect`** – bewusst: Effekte laufen NACH dem ersten
   * Zeichnen. Die Seiten stünden dann einen Wimpernschlag lang ohne die Notizen da, weil die App
   * seit dem Arrangement-Segment unter dem neuen Schlüssel sucht und der Bestand noch unter dem
   * alten liegt. Der Vorgang ist rein lokal, synchron und idempotent (ein zweiter Lauf findet
   * nichts mehr) – damit ist er an dieser Stelle unbedenklich.
   *
   * Läuft über ALLE Lieder des Ablaufs, nicht nur das offene: Der Strom zeigt im Querformat auch
   * Seiten des Nachbarlieds.
   */
  useMemo(() => {
    for (const s of songs) arrangementMigrationAnwenden(s.id, s.arrangementId);
  }, [songs]);
  // Signatur über den INHALT aller Versionen → der Strom wird neu erzeugt, sobald sich ein Lied-Text
  // ändert (z. B. nach dem Bearbeiten/Anlegen einer Version), nicht nur bei geänderter Lied-Liste.
  const songsSig = songs
    .map(
      (s) =>
        `${s.id}:${s.chordpro?.length ?? 0}:${s.versions.map((v) => v.key + v.text.length).join('|')}`,
    )
    .join(',');

  const [drawMode, setDrawMode] = useState(false);
  /**
   * Auffrischen im Hintergrund (Erst-Sync, 30-s-/60-s-Takt, Rückkehr zur App) – in `useChartSync`.
   *
   * Die Liste der Teilenden gehört zum Erst-Sync, `refreshSharers` entsteht aber erst weiter unten
   * in `useTeamNotesImport`, das seinerseits `setSyncTick` von hier braucht. Der Rückruf zeigt
   * deshalb über eine Ref auf die dann vorhandene Funktion; gelesen wird sie erst im Effekt, also
   * lange nach dem Render.
   */
  const teamNotizenNachlauf = useRef<(() => void) | null>(null);
  const { syncTick, setSyncTick, bumpSync } = useChartSync({
    songs,
    songsSig,
    drawMode,
    onReload,
    reloadSettings,
    onAfterInitialPull: () => teamNotizenNachlauf.current?.(),
  });

  /**
   * EIN Zustand für alle Auswahl-Overlays statt fünf Booleans (#283).
   *
   * Sie schließen sich gegenseitig aus – mit fünf unabhängigen Flaggen war ein Zustand darstellbar,
   * den es nicht geben darf (zwei Overlays gleichzeitig offen). Mit einem Feld ist er nicht mehr
   * ausdrückbar, und beim Öffnen des einen ist das andere automatisch zu.
   */
  const [overlay, setOverlay] = useState<
    'key' | 'capo' | 'sec' | 'appearance' | 'menu' | 'tempo' | null
  >(null);
  /** Ein Overlay umschalten (nochmal derselbe Knopf schließt es). */
  const toggleOverlay = (o: 'appearance' | 'menu' | 'tempo') =>
    setOverlay((cur) => (cur === o ? null : o));

  const { toast, showToast } = useToast();
  // ── Team-Notizen (#124, PCO-Modell): „Notizen von …" ansehen + übernehmen ──
  // Ganzer Ansehen-/Import-Zustand samt abgeleiteter effSettings gekapselt in useTeamNotesImport.
  // Import-Vorschau: das Chart zeigt LIVE das Ergebnis (merge = eigene + fremde Ebene übereinander,
  // replace = nur die fremde); unten schwebt die Vorschau-Leiste mit Umschalter + Übernehmen.
  const {
    viewing,
    pickerPerson,
    setPickerPerson,
    sharers,
    showSharers,
    setShowSharers,
    viewMode,
    setViewMode,
    effSettings,
    refreshSharers,
    openPersonLevels,
    viewLevel,
    stopViewing,
    mirrorGroups,
    groupKeyOf,
    importFrom,
    openSharers,
  } = useTeamNotesImport({
    songs,
    settings,
    reloadSettings,
    setSyncTick,
    setDrawMode,
    showToast,
  });
  // Erst jetzt steht `refreshSharers` – der Erst-Sync greift über die Ref darauf zu (siehe oben).
  teamNotizenNachlauf.current = canUseGlobalNotes ? refreshSharers : null;

  // Geführte Einführung Chart-Ansicht (#Onboarding, Gruppe 2): startet beim ersten Öffnen, sobald
  // die Seiten gerendert sind (dann existieren die hervorzuhebenden Elemente).
  const [chartTour, setChartTour] = useState(false);
  // Anmerkungs-Farben: feste ECG-Palette (unten `DRAW_COLORS`), plus der freie Farbwähler in der
  // Leiste. Kein Weiß und kein Dunkelmodus-Wechsel – gezeichnet wird immer auf weißen PDF-Seiten.
  const [drawColor, setDrawColor] = useState('#0062ac'); // Standard-Anmerkungsfarbe: Blau
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [streamZoomed, setStreamZoomed] = useState(false); // eine sichtbare Seite (Strom oder Dokument) ist reingezoomt
  // Tempo-Puls (#145): bewusst NICHT gemerkt – er ist ein Werkzeug zum Einzählen, keine Ansicht.
  // Beim Öffnen des Liederhefts ist er immer aus, damit im Gottesdienst nichts unerwartet blinkt.
  const [bpmPulse, setBpmPulse] = useState(false);
  // Hörbarer Klick – wie der Puls bewusst NICHT gemerkt. Ein Gerät, das beim Öffnen von selbst
  // losklickt, wäre im Gottesdienst eine Panne.
  const [klickModus, setKlickModus] = useState<KlickModus>('aus');
  /**
   * Im Tempo-Menü eingestelltes Tempo. `null` heißt „wie im Lied".
   *
   * Der Wert liegt HIER und nicht im Menü, weil Puls und Klick ihm folgen müssen: Wer ein Tempo
   * antippt, soll es erst hören und dann speichern. Läge er im Menü, klänge der Klick weiter im
   * alten Tempo, während das Menü ein neues anzeigt.
   */
  const [tempoWert, setTempoWert] = useState<number | null>(null);
  /**
   * Vollbild: Kopf- und Fußzeile ausgeblendet (#319). Ein Tipp in die Mitte schaltet um.
   *
   * Bewusst NICHT gemerkt – wie der Tempo-Puls ein Werkzeug für den Moment. Wer das Liederheft neu
   * öffnet, findet die Leisten wieder vor; sonst stünde man beim nächsten Mal vor einem Blatt ohne
   * jede Bedienung und wüsste nicht, warum.
   */
  const [leistenAus, setLeistenAus] = useState(false);
  const [resetZoomSignal, setResetZoomSignal] = useState(0); // erhöhen → PageDeck setzt sichtbaren Zoom zurück
  // Erhöhen → die verfügbare Fläche hat sich geändert (Leisten umgeschaltet, #319). PageDeck baut
  // daraufhin die Zoom-Ebene neu auf, damit sie die neue Höhe vermisst, und passt eine vergrößerte
  // Seite ein – ohne den gespeicherten Zoom zu vergessen.
  const [layoutEpoch, setLayoutEpoch] = useState(0);

  // ── Durchgehender Seitenstrom: alle Lieder zu EINER PDF (mit Seiten-Besitzer) ──
  // Aufbau in `useChartStream` – bewusst NACH dem Zeichnen, mit stehenbleibendem
  // altem Ergebnis (#197).
  const logo = useAppLogo();
  const stream = useChartStream({ songs, songsSig, settings: effSettings, logo });

  // Durchgehender Strom: Akkord- UND Dokument-Seiten in Setlist-Reihenfolge zu EINER Seiten-Liste
  // (jedes Lied steuert je nach viewSource seine Akkorde ODER sein hochgeladenes Dokument bei).
  const {
    pages,
    owners,
    publishedSettings,
    loading: pagesLoading,
    error: pagesError,
  } = useSetlistPages({
    chordPdfData: stream?.data ?? null,
    chordOwners: stream?.owners ?? [],
    songs,
    settings: effSettings,
    // Ein gewähltes Dokument, das nicht geladen werden konnte, fällt auf die Akkorde zurück – das
    // soll der Nutzer erfahren, statt sich zu fragen, warum sein PDF nicht kommt (#251).
    onDocError: (titel) =>
      showToast(
        titel.length === 1
          ? `Das Dokument zu „${titel[0]}" konnte nicht geladen werden – es werden die Akkorde gezeigt.`
          : `${titel.length} Dokumente konnten nicht geladen werden – es werden die Akkorde gezeigt.`,
      ),
  });

  // Akkord-Datei nicht ladbar (#274): Vorher blieb das Blatt einfach leer. Der Server sagt jetzt, ob
  // der Fehlschlag vorübergehend war (ein echtes 404 zählt nicht) – dann bekommt der Nutzer eine
  // Meldung statt einer leeren Seite. Je Lied nur EINMAL, sonst poppt es bei jedem Blättern wieder.
  const gemeldeteLadefehler = useRef(new Set<number>());
  useEffect(() => {
    const offen = songs.filter((s) => s.chordproFailed && !gemeldeteLadefehler.current.has(s.id));
    if (offen.length === 0) return;
    for (const s of offen) gemeldeteLadefehler.current.add(s.id);
    showToast(
      offen.length === 1
        ? `Die Akkorde zu „${offen[0].title}" konnten nicht geladen werden. Bitte später erneut versuchen.`
        : `${offen.length} Lieder konnten nicht geladen werden. Bitte später erneut versuchen.`,
    );
  }, [songs, showToast]);

  // Einführung Chart-Ansicht beim ersten Mal starten – erst wenn die Seiten fertig gerendert sind.
  useEffect(() => {
    if (!pagesLoading && pages.length > 0 && !isTourDone(TOUR_CHART)) setChartTour(true);
  }, [pagesLoading, pages.length]);

  // Blättern/Ausrichtung/Tastatur. Tastatur-Navigation pausiert, solange Editor oder Zeichenmodus
  // offen sind (per Ref übergeben, weil `showEditor` erst unten aus dem Editor-Hook kommt).
  const navBlockedRef = useRef(false);
  const { pageIdx, activeIdx, atStart, atEnd, next, prev, goToSong, setPage, setActivePage } =
    useChartNavigation({ owners, startIndex, blockedRef: navBlockedRef });

  const activeSongIdx = owners[activeIdx]?.songIdx ?? 0;
  const song = songs[activeSongIdx] ?? songs[songs.length - 1];
  const set = effSettings[song.id] ?? DEFAULT_SETTINGS;
  // Ansehen gilt pro Lied: Blättert man zu einem anderen Lied, endet es automatisch.
  useEffect(() => {
    if (viewing && song.id !== viewing.songId) stopViewing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]);
  // Darstellung/Version/Quelle DESSELBEN Lieds gewechselt → Anmerkungsmodus beenden: Die Notiz-
  // Ebene wechselt mit, ein noch aktiver Stift würde sonst im Umbau-Moment in die falsche Ebene
  // schreiben. (Liedwechsel beim Blättern lässt den Modus bewusst an.)
  const lastViewSig = useRef<{ songId: number; sig: string } | null>(null);
  useEffect(() => {
    const sig = `${set.versionKey}|${set.lyricsOnly ? 1 : 0}|${set.viewSource}`;
    const prev = lastViewSig.current;
    if (prev && prev.songId === song.id && prev.sig !== sig) setDrawMode(false);
    lastViewSig.current = { songId: song.id, sig };
  }, [song.id, set.versionKey, set.lyricsOnly, set.viewSource]);
  // Personen, die Anmerkungen ZUM AKTIVEN Lied teilen (für den Wähler).
  const songSharers = sharers.filter((p) => p.songs.includes(song.id));

  // Aktuell SICHTBARE Lieder (fürs Fußzeilen-Punkte-Highlight): im Querformat 2 Seiten → bis zu
  // 2 Lieder nebeneinander, beide markieren. matchMedia('orientation') ist beim Wechsel stabil.
  const landscape = useLandscape();
  const visibleSongIdx = new Set<number>();
  if (owners[pageIdx]) visibleSongIdx.add(owners[pageIdx].songIdx);
  if (landscape && owners[pageIdx + 1]) visibleSongIdx.add(owners[pageIdx + 1].songIdx);
  if (visibleSongIdx.size === 0) visibleSongIdx.add(activeSongIdx);

  // ── abgeleitete Werte des AKTIVEN Lieds ──
  // Rein und getestet in `utils/activeSongView` (#314): Tonart, Kapo-Griffe, Versionen, gewähltes
  // Dokument, Editor-Vorlage und die Info-Zeile im Kopf.
  const {
    curKey,
    shapeKey,
    versions,
    currentVersion,
    isOriginal,
    hasVersions,
    displayedChordpro,
    sections,
    editorTemplate,
    activeDoc,
    headInfo,
  } = deriveActiveSongView(song, set);

  /**
   * Wirksames Tempo: das eingestellte, sonst das aus ChurchTools. Steht EINMAL hier und wird von
   * Kopfzeile, Puls, Klick und Menü gemeinsam benutzt – jede Stelle, die stattdessen selbst
   * `tempoWert ?? song.bpm` rechnete, wäre eine Kopie dieser Regel.
   */
  const wirksamesTempo = tempoWert ?? song.bpm;

  /**
   * Zählweise und was daraus folgt (#145).
   *
   * Die gespeicherte Tempo-Zahl meint IMMER die Grundschläge – gezählt wird aber unter Umständen
   * gröber (6/8 in Dreiergruppen, schnelles 4/4 in Halben). Beide Rechnungen stehen EINMAL hier;
   * Puls und Klick bekommen fertig das gezählte Tempo und die gezählte Taktlänge, statt jeder für
   * sich aus Taktart und Zählweise dasselbe abzuleiten.
   */
  const { klickTempo, schlaegeProTakt } = taktRaster(wirksamesTempo, song.timeSig, set.zaehlweise);

  // Beim Liedwechsel zurück auf „wie im Lied". Ein eingestelltes Tempo gehört zu DIESEM Lied; es
  // beim Blättern mitzunehmen hieße, das nächste Lied stillschweigend im falschen Takt zu klicken.
  const liedZuvor = useRef(song.id);
  useEffect(() => {
    if (liedZuvor.current === song.id) return;
    liedZuvor.current = song.id;
    setTempoWert(null);
  }, [song.id]);

  /**
   * Nullpunkt des gemeinsamen Takt-Rasters, in `performance.now()`-Millisekunden.
   *
   * Puls und Klick hatten je eine eigene Uhr – wer sie nacheinander einschaltete, bekam zwei
   * Nullpunkte und damit zwei Takte. Jetzt gibt es EINEN, gesetzt beim Einschalten des ersten von
   * beiden und gelöscht, wenn keiner mehr läuft. Der Zweite steigt in das laufende Raster ein,
   * statt bei sich selbst anzufangen.
   *
   * Beim TEMPOWECHSEL wird das Raster neu gesetzt: Aus einem festen Nullpunkt und einer neuen
   * Schlagdauer folgte sonst ein Sprung mitten im Takt. Ein Metronom fängt bei neuem Tempo neu an.
   */
  const [taktStart, setTaktStart] = useState<number | null>(null);
  const taktLaeuft = bpmPulse || klickModus !== 'aus';
  const taktTempo = useRef(wirksamesTempo);
  useEffect(() => {
    if (!taktLaeuft) {
      setTaktStart(null);
      return;
    }
    setTaktStart((bisher) =>
      bisher === null || taktTempo.current !== wirksamesTempo ? performance.now() : bisher,
    );
    taktTempo.current = wirksamesTempo;
  }, [taktLaeuft, wirksamesTempo]);

  // Hörbarer Klick auf der Audio-Uhr. Endet er von selbst (Einzählen fertig), zieht der Modus nach –
  // sonst stünde das Menü weiter auf „Einzählen", obwohl längst nichts mehr klingt.
  useMetronome({
    bpm: klickTempo,
    schlaegeProTakt,
    modus: klickModus,
    taktStartMs: taktStart,
    onEnde: () => setKlickModus('aus'),
  });

  // Anmerkungs-/Zoom-Schlüssel je Strom-Seite. Die Regeln – welche Darstellungsart gilt, wann es
  // KEINEN Schlüssel gibt – stehen rein und getestet in `utils/chartPageKeys` (#314); hier nur die
  // Verdrahtung an die aktuellen Daten.
  const drawKeyFor = (page: number): string | null =>
    drawKeyForPage(page, owners, publishedSettings, effSettings);
  const zoomKeyBaseFor = (page: number): string =>
    zoomKeyBaseForPage(page, owners, publishedSettings, effSettings);
  const pageLabel = (activePg: number, pageIdx: number): string | null =>
    pageLabelFor(activePg, pageIdx, owners);
  // „Notizen von …": stabile Identität für die PageDeck-Effekte, deshalb `useCallback`.
  // `viewingId` gehört bewusst in die Abhängigkeiten, obwohl er im Schlüssel nicht vorkommt: Beim
  // Wechsel auf eine andere Person mit derselben Ebene bliebe die Funktion sonst identisch, und
  // PageDeck bekäme kein Signal, den Ansichts-Spiegel neu zu lesen.
  const viewingId = viewing?.id ?? null;
  const viewingSongId = viewing?.songId ?? null;
  const viewingLyr = viewing?.lyr ?? false;
  const viewKeyFor = useCallback(
    (page: number): string | null =>
      viewKeyForPage(
        page,
        owners,
        viewingId == null || viewingSongId == null
          ? null
          : { songId: viewingSongId, lyr: viewingLyr },
        VIEW_NS,
      ),
    [owners, viewingId, viewingSongId, viewingLyr],
  );

  /**
   * „Als PDF teilen" – das aktive Lied als einzelne PDF.
   *
   * Geht über `pdfOptionsForSong`, dieselbe Funktion, die auch den Seitenstrom der Anzeige baut.
   * Vorher baute diese Stelle die Optionen selbst und übergab `totalOffset` – also OHNE den
   * Kapo-Abzug. Bei gesetztem Kapo war das geteilte PDF dadurch anders transponiert als der
   * Bildschirm (#239). Es darf hier keine zweite Fassung dieser Rechnung geben.
   */
  const shareCurrentAsPdf = (): void => {
    const doc = generateChordPdf(
      { ...song, chordpro: displayedChordpro },
      pdfOptionsForSong(song, set, logo),
    );
    void sharePdf(doc, song.title);
  };

  // ChordPro-Versionen anlegen/bearbeiten/löschen (Zustand + ChurchTools-Aufrufe im Hook gebündelt).
  const {
    showEditor,
    setShowEditor,
    editorSaving,
    editorError,
    editor,
    confirmDelEdited,
    setConfirmDelEdited,
    openEditCurrent,
    openNewVersion,
    handleEditorSave,
    handleDeleteVersion,
  } = useChartEditor({
    song,
    versionKey: set.versionKey,
    isOriginal,
    currentVersionName: currentVersion.name,
    displayedChordpro,
    editorTemplate,
    onReload,
    selectVersion,
  });
  // Tastatur-Navigation aussetzen, solange Editor oder Zeichenmodus offen sind.
  navBlockedRef.current = showEditor || drawMode;

  // Beim SCHLIESSEN des Editors die Anzeige neu ausrichten (Begründung im Hook).
  useResyncAfterEditor(showEditor, bumpSync);

  /**
   * Tipp in die Mitte: Leisten aus-/einblenden (#319).
   *
   * Beim ERSTEN Ausblenden ein einmaliger Hinweis – mit ausgeblendeten Leisten ist auch der
   * Zurück-Knopf weg, und dass ein weiterer Tipp sie zurückholt, sieht man dem Blatt nicht an.
   */
  const leistenUmschalten = () => {
    const wirdAusgeblendet = !leistenAus;
    setLeistenAus(wirdAusgeblendet);
    // Der Hinweis steht BEWUSST außerhalb der `setLeistenAus`-Aktualisierung. Solche Funktionen
    // müssen frei von Nebenwirkungen sein – React ruft sie unter Umständen mehrfach auf und darf
    // Ergebnisse verwerfen. Als Merker und Toast noch darin standen, **erschien der Hinweis nie**
    // (empirisch beim Durchklicken festgestellt; welcher der beiden Mechanismen genau griff, wurde
    // nicht weiter untersucht – die Regel gilt so oder so).
    if (wirdAusgeblendet && !isTourDone(HINT_VOLLBILD)) {
      markTourDone(HINT_VOLLBILD);
      showToast('Leisten ausgeblendet – nochmal in die Mitte tippen holt sie zurück.');
    }
    // Die Anzeigefläche ändert ihre HÖHE – eine vergrößerte Seite muss neu eingepasst werden,
    // sonst ragt der Text hinter die Fußzeile (genau der gemeldete Fehler).
    //
    // BEWUSST NICHT `bumpSync()`: Das löst `restoreVisibleZoom` aus, und das wendet einen
    // GESPEICHERTEN Zoom erneut an – also wieder eine Größe, die in die neue Fläche nicht passt.
    // Und bewusst nicht `resetZoomSignal`: Das löscht den gespeicherten Zoom, was hier zu viel
    // wäre – der Nutzer hat ihn nicht zurückgenommen, sondern nur die Leisten umgeschaltet.
    setLayoutEpoch((n) => n + 1);
  };

  const nextSong = activeSongIdx < songs.length - 1 ? songs[activeSongIdx + 1] : null;

  return (
    <Screen className={styles.chartScreen}>
      <>
        {!leistenAus && (
          <ChartHeader
            songTitle={song.title}
            headInfo={headInfo}
            menuOpen={overlay === 'menu'}
            appearanceOpen={overlay === 'appearance'}
            viewing={viewing !== null}
            showsDocument={activeDoc !== null}
            canUseGlobalNotes={canUseGlobalNotes}
            drawMode={drawMode}
            zoomed={streamZoomed}
            bpmPulse={bpmPulse}
            pulsBpm={wirksamesTempo}
            klickBpm={klickTempo}
            taktStartMs={taktStart}
            schlaegeProTakt={schlaegeProTakt}
            tempoOpen={overlay === 'tempo'}
            tempoAktiv={bpmPulse || klickModus !== 'aus'}
            onToggleTempo={() => toggleOverlay('tempo')}
            onBack={onBack}
            onToggleMenu={() => toggleOverlay('menu')}
            onToggleAppearance={() => toggleOverlay('appearance')}
            onResetZoom={() => setResetZoomSignal((n) => n + 1)}
            onToggleTeamNotes={() => (viewing ? stopViewing() : openSharers())}
            onToggleDraw={() => setDrawMode((d) => !d)}
          />
        )}

        {viewing && (
          <ViewingBanner
            personName={viewing.name}
            versionName={
              versions.find((v) => v.key === viewing.versionKey)?.name ?? viewing.versionKey
            }
            otherVersion={(settings[song.id]?.versionKey ?? 'original') !== viewing.versionKey}
            lyricsOnly={viewing.lyr}
          />
        )}

        {overlay === 'tempo' && (
          <TempoMenu
            liedTempo={song.bpm}
            wert={tempoWert}
            onWert={setTempoWert}
            timeSig={song.timeSig}
            zaehlweise={set.zaehlweise}
            onZaehlweise={(z) => updateSetting(song.id, { zaehlweise: z })}
            puls={bpmPulse}
            onPuls={setBpmPulse}
            klick={klickModus}
            onKlick={setKlickModus}
            darfSpeichern={canEditSong}
            onSpeichern={async (tempo) => {
              await setArrangementTempo(song.id, song.arrangementId, tempo);
              // Der Ablauf wird neu geladen, damit das neue Tempo überall steht. Danach ist das
              // eingestellte Tempo KEINE Abweichung mehr – der Merker gehört zurück auf „wie im
              // Lied", sonst bliebe der Speichern-Knopf aktiv und böte dasselbe nochmal an.
              onReload?.();
              setTempoWert(null);
              showToast(`Tempo ${tempo} in ChurchTools gespeichert.`);
            }}
            onClose={() => setOverlay(null)}
          />
        )}

        <ChartOverlays
          // Das Tempo-Menü ist bewusst KEIN `ChartOverlay`: Es teilt sich zwar die Regel „höchstens
          // eines offen", hat aber eine ganz andere Bedienung. Deshalb hier herausgefiltert, statt
          // den Typ dort aufzuweichen.
          overlay={overlay === 'tempo' ? null : overlay}
          onOverlay={setOverlay}
          song={song}
          set={set}
          curKey={curKey}
          shapeKey={shapeKey}
          sections={sections}
          versions={versions}
          currentVersion={currentVersion}
          isOriginal={isOriginal}
          hasVersions={hasVersions}
          canEditSong={canEditSong}
          onSetting={(patch) => updateSetting(song.id, patch)}
          onSelectVersion={(versionKey) => selectVersion(song.id, versionKey)}
          onSharePdf={shareCurrentAsPdf}
          onEditCurrent={openEditCurrent}
          onNewVersion={openNewVersion}
          onDeleteVersion={() => setConfirmDelEdited(true)}
        />

        {/* Anzeige-Bereich: EIN durchgehender Strom (Akkorde + Dokumente gemischt) */}
        <div className={styles.chartArea} data-tour="chart-blaettern">
          {songs.length > 0 ? (
            <PageDeck
              pages={pages}
              loading={pagesLoading}
              error={pagesError}
              loadingLabel="Lieder werden vorbereitet…"
              drawKeyFor={drawKeyFor}
              viewKeyFor={viewKeyFor}
              previewOwn={viewMode === 'merge'}
              zoomKeyBaseFor={zoomKeyBaseFor}
              pageLabel={pageLabel}
              pageIndex={pageIdx}
              onPageIndex={setPage}
              activePage={activeIdx}
              onActivePage={setActivePage}
              drawMode={drawMode}
              drawColor={drawColor}
              setDrawColor={setDrawColor}
              drawTool={drawTool}
              setDrawTool={setDrawTool}
              drawColors={DRAW_COLORS}
              syncTick={syncTick}
              onMiddleTap={leistenUmschalten}
              layoutEpoch={layoutEpoch}
              onZoomedChange={setStreamZoomed}
              resetZoomSignal={resetZoomSignal}
            />
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎵</div>
              <div>Für dieses Lied ist keine Akkord-Datei in ChurchTools hinterlegt.</div>
              {canEditSong && (
                <button className={styles.createBtn} onClick={openNewVersion}>
                  Akkord-Datei erstellen
                </button>
              )}
            </div>
          )}
        </div>

        {showEditor && (
          <ChordEditor
            songTitle={song.title}
            initialText={editor.text}
            initialName={editor.name}
            isNew={editor.mode === 'new'}
            saving={editorSaving}
            error={editorError}
            onSave={handleEditorSave}
            onDelete={editor.mode === 'edit' ? () => setConfirmDelEdited(true) : undefined}
            onClose={() => setShowEditor(false)}
          />
        )}

        {confirmDelEdited && (
          <ConfirmDialog
            title="Version löschen?"
            message={`Die Version „${currentVersion.name}" von „${song.title}" wird aus ChurchTools entfernt. Das Original bleibt erhalten.`}
            confirmLabel={editorSaving ? 'Löschen…' : 'Löschen'}
            onConfirm={() => void handleDeleteVersion()}
            onCancel={() => setConfirmDelEdited(false)}
          />
        )}

        {!leistenAus && (
          <ChartFooter
            songCount={songs.length}
            visibleSongIdx={visibleSongIdx}
            nextSongTitle={nextSong?.title ?? null}
            atStart={atStart}
            atEnd={atEnd}
            onPrev={prev}
            onNext={next}
            onGoToSong={goToSong}
          />
        )}

        {viewing && (
          <ImportPreviewBar
            mode={viewMode}
            onMode={setViewMode}
            onImport={(m) => void importFrom(m)}
            onPickOther={openSharers}
            onStop={stopViewing}
          />
        )}

        {/* „Notizen von …": Stufe 1 = Person wählen, Stufe 2 = ihre Ebene (Version + Darstellung). */}
        {showSharers && (
          <SharersSheet
            songTitle={song.title}
            sharers={songSharers}
            pickerPerson={pickerPerson}
            levels={mirrorGroups()}
            versionName={(key) => versions.find((v) => v.key === key)?.name ?? key}
            levelKey={groupKeyOf}
            onPickPerson={(p) => void openPersonLevels(p, song.id)}
            onPickLevel={(g) => viewLevel(song.id, g.versionKey, g.lyr)}
            onBackToPersons={() => setPickerPerson(null)}
            onClose={() => setShowSharers(false)}
          />
        )}

        <Toast message={toast} />

        {chartTour && (
          <Coachmarks
            steps={CHART_STEPS}
            onClose={() => {
              markTourDone(TOUR_CHART);
              setChartTour(false);
            }}
          />
        )}
      </>
    </Screen>
  );
}
