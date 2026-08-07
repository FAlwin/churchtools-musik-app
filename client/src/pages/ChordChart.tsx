import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { Screen } from '../components/Screen';
import { KeyPicker } from '../components/KeyPicker';
import { CapoPicker } from '../components/CapoPicker';
import { SectionTransposeSheet } from '../components/SectionTransposeSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ChordEditor } from '../components/ChordEditor';
import { PageDeck } from '../components/PageDeck';
import { useSongSettings } from '../hooks/useSongSettings';
import { useLandscape } from '../hooks/useLandscape';
import { Coachmarks } from '../components/Coachmarks';
import { CHART_STEPS, TOUR_CHART, isTourDone, markTourDone } from '../utils/onboarding';
import { Icon } from '../components/icons';
import {
  migrateLocalAnnotations,
  pullAnnotations,
  resumePendingAnnotations,
} from '../services/annotations';
import { VIEW_NS } from '../services/teamNotes';
import {
  drawKeyForPage,
  pageLabelFor,
  viewKeyForPage,
  zoomKeyBaseForPage,
} from '../utils/chartPageKeys';
import { ChartAppearanceMenu } from '../components/ChartAppearanceMenu';
import { SongMenu } from '../components/SongMenu';
import { SharersSheet } from '../components/SharersSheet';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import {
  migrateLocalSettings,
  pullSettings,
  resumePendingSettings,
} from '../services/userSettings';
import { versionText } from '../utils/songVersions';
import { deriveActiveSongView } from '../utils/activeSongView';
import { generateChordPdf, generateSetlistPdfWithOwners } from '../utils/chordPdf';
import type { SetlistPageOwner } from '../utils/chordPdf';
import { pdfOptionsForSong } from '../utils/chartPdfOptions';
import { sharePdf } from '../utils/sharePdf';
import { DEFAULT_SETTINGS, loadSettings } from '../utils/chartSettings';
import { logoTightUrl } from '../utils/logoAsset';
import { useTeamNotesImport } from '../hooks/useTeamNotesImport';
import { useChartNavigation } from '../hooks/useChartNavigation';
import { useChartEditor } from '../hooks/useChartEditor';
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
  // Signatur über den INHALT aller Versionen → der Strom wird neu erzeugt, sobald sich ein Lied-Text
  // ändert (z. B. nach dem Bearbeiten/Anlegen einer Version), nicht nur bei geänderter Lied-Liste.
  const songsSig = songs
    .map(
      (s) =>
        `${s.id}:${s.chordpro?.length ?? 0}:${s.versions.map((v) => v.key + v.text.length).join('|')}`,
    )
    .join(',');

  // Anmerkungen pro Konto: bestehende Geräte-Anmerkungen einmalig hochladen, dann die
  // Server-Anmerkungen dieser Lieder in den lokalen Cache holen und Anzeige neu laden.
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ids = songs.map((s) => s.id);
      // Reihenfolge ist wichtig: Erst die beim letzten Mal NICHT durchgegangenen Uploads nachholen
      // (#256 Anmerkungen, #275 Einstellungen) und bestehende lokale Daten einmalig hochladen – DANN
      // den Server-Stand holen. Andernfalls überschreibt der Pull genau das, was noch hochzuladen ist.
      await Promise.all([resumePendingAnnotations(), resumePendingSettings()]);
      await Promise.all([migrateLocalAnnotations(), migrateLocalSettings()]);
      await Promise.all([pullAnnotations(ids), pullSettings(ids)]);
      // Team-Notizen: wer teilt Anmerkungen zu diesen Liedern? (nur für Berechtigte)
      if (canUseGlobalNotes) refreshSharers();
      if (cancelled) return;
      // Einstellungen aus dem (jetzt gespiegelten) localStorage neu übernehmen.
      reloadSettings();
      setSyncTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songsSig]);

  /**
   * EIN Zustand für alle Auswahl-Overlays statt fünf Booleans (#283).
   *
   * Sie schließen sich gegenseitig aus – mit fünf unabhängigen Flaggen war ein Zustand darstellbar,
   * den es nicht geben darf (zwei Overlays gleichzeitig offen). Mit einem Feld ist er nicht mehr
   * ausdrückbar, und beim Öffnen des einen ist das andere automatisch zu.
   */
  const [overlay, setOverlay] = useState<'key' | 'capo' | 'sec' | 'appearance' | 'menu' | null>(
    null,
  );
  /** Ein Overlay umschalten (nochmal derselbe Knopf schließt es). */
  const toggleOverlay = (o: 'appearance' | 'menu') => setOverlay((cur) => (cur === o ? null : o));

  const [drawMode, setDrawMode] = useState(false);
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
  // Geführte Einführung Chart-Ansicht (#Onboarding, Gruppe 2): startet beim ersten Öffnen, sobald
  // die Seiten gerendert sind (dann existieren die hervorzuhebenden Elemente).
  const [chartTour, setChartTour] = useState(false);
  // Anmerkungs-Farben: feste ECG-Palette (unten `DRAW_COLORS`), plus der freie Farbwähler in der
  // Leiste. Kein Weiß und kein Dunkelmodus-Wechsel – gezeichnet wird immer auf weißen PDF-Seiten.
  const [drawColor, setDrawColor] = useState('#0062ac'); // Standard-Anmerkungsfarbe: Blau
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [streamZoomed, setStreamZoomed] = useState(false); // eine sichtbare Seite (Strom oder Dokument) ist reingezoomt
  const [resetZoomSignal, setResetZoomSignal] = useState(0); // erhöhen → PageDeck setzt sichtbaren Zoom zurück

  // App-Logo für die PDF-Kopfzeile (oben rechts) einmalig vorladen. Quelle ist die eingebettete
  // Data-URI (logoAsset) → auch offline sofort da (loser public-Pfad wurde offline nicht gecacht).
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setLogoImg(img);
    img.src = logoTightUrl;
  }, []);

  // Auto-Auffrischung: aktuelle Werte in einer Ref, damit der Effekt stabil bleibt.
  const liveRef = useRef({ songs, drawMode, onReload, lastReturn: 0 });
  liveRef.current.songs = songs;
  liveRef.current.drawMode = drawMode;
  liveRef.current.onReload = onReload;
  useEffect(() => {
    // Anmerkungen (pro Konto) regelmäßig vom Server holen – pausiert im Zeichenmodus/Hintergrund.
    async function refreshAnno() {
      if (document.hidden || liveRef.current.drawMode) return;
      await pullAnnotations(liveRef.current.songs.map((s) => s.id));
      setSyncTick((t) => t + 1);
    }
    // Beim Zurückkehren zur App: Anmerkungen, Einstellungen UND Versionen (Setlist) auffrischen.
    async function onReturn() {
      if (document.hidden) return;
      const now = Date.now();
      if (now - liveRef.current.lastReturn < 2000) return; // focus+visibility entprellen
      liveRef.current.lastReturn = now;
      const list = liveRef.current.songs;
      if (!liveRef.current.drawMode) {
        await Promise.all([
          pullAnnotations(list.map((s) => s.id)),
          pullSettings(list.map((s) => s.id)),
        ]);
        reloadSettings();
        setSyncTick((t) => t + 1);
      }
      liveRef.current.onReload?.();
    }
    // Inhalt (Ablauf/Liedtexte) alle 60 s still nachladen – ersetzt den früheren
    // „Aktualisieren"-Knopf: Änderungen erscheinen auch, wenn das Gerät die ganze Zeit offen im
    // Lied bleibt (z. B. iPad auf der Bühne). Neu gezeichnet wird nur bei echten Änderungen
    // (songsSig); offline scheitert das Nachladen lautlos.
    function refreshContent() {
      if (document.hidden || liveRef.current.drawMode) return;
      liveRef.current.onReload?.();
    }
    const id = setInterval(() => void refreshAnno(), 30000);
    const idContent = setInterval(() => void refreshContent(), 60000);
    // `onReturn` ist async → in einen void-Wrapper, damit kein unbehandeltes Promise entsteht (#279).
    const onReturnSync = (): void => void onReturn();
    window.addEventListener('focus', onReturnSync);
    document.addEventListener('visibilitychange', onReturnSync);
    return () => {
      clearInterval(id);
      clearInterval(idContent);
      window.removeEventListener('focus', onReturnSync);
      document.removeEventListener('visibilitychange', onReturnSync);
    };
    // `reloadSettings` hat eine stabile Identität (useCallback über eine Ref) – die Intervalle und
    // Listener werden dadurch NICHT erneut angemeldet.
  }, [reloadSettings]);

  // ── Durchgehender Seitenstrom: alle Lieder zu EINER PDF (mit Seiten-Besitzer) ──
  // Der Aufbau lief bis #197 in einem useMemo, also MITTEN IM RENDER: Bei jeder Änderung von
  // Tonart/Spalten/Schrift stand die Oberfläche, bis das komplette Liederheft neu erzeugt war (auf
  // einem älteren iPad deutlich spürbar – das Menü blieb offen, nichts reagierte).
  // Jetzt außerhalb des Renders in einem Effekt: Erst zeichnet der Browser (Menü schließt, Gesten
  // laufen weiter), danach wird gebaut. Bis das neue Ergebnis da ist, bleibt das ALTE stehen –
  // deshalb State statt Memo, sonst blitzte zwischendurch eine leere Ansicht auf.
  // Ehrlich: jsPDF bleibt synchron, der Aufbau blockiert also weiterhin kurz den Hauptthread –
  // nur eben NACH dem Zeichnen. Ihn ganz auszulagern bräuchte einen Web Worker (eigenes Thema).
  const [stream, setStream] = useState<{ data: ArrayBuffer; owners: SetlistPageOwner[] } | null>(
    null,
  );
  useEffect(() => {
    if (songs.length === 0) {
      setStream(null);
      return;
    }
    let cancelled = false;
    const build = (): void => {
      if (cancelled) return;
      const songsForPdf = songs.map((s) => {
        const st = effSettings[s.id] ?? loadSettings(s);
        return { ...s, chordpro: versionText(s, st.versionKey), versionKey: st.versionKey };
      });
      const { doc, owners } = generateSetlistPdfWithOwners(songsForPdf, (s) =>
        pdfOptionsForSong(s, effSettings[s.id] ?? loadSettings(s), logoImg),
      );
      // Zwischenzeitlich hat sich die Eingabe geändert → dieses Ergebnis ist veraltet, verwerfen.
      if (cancelled) return;
      setStream({ data: doc.output('arraybuffer'), owners });
    };
    // Nach dem Zeichnen bauen; `requestIdleCallback` lässt Eingaben zuerst durch, der Timeout
    // sorgt dafür, dass es auch bei Dauerlast zügig passiert. Ältere Safari-Versionen kennen
    // rIC nicht – dort genügt ein Timeout 0 (auch das läuft erst nach dem Zeichnen).
    let cancelScheduled: () => void;
    if (typeof window.requestIdleCallback === 'function') {
      const h = window.requestIdleCallback(build, { timeout: 300 });
      cancelScheduled = () => window.cancelIdleCallback(h);
    } else {
      const h = window.setTimeout(build, 0);
      cancelScheduled = () => window.clearTimeout(h);
    }
    return () => {
      cancelled = true;
      cancelScheduled();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songsSig, effSettings, logoImg]);

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
      pdfOptionsForSong(song, set, logoImg),
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

  // Beim SCHLIESSEN des Editors die Chart-Ansicht neu ausrichten (syncTick): Der Editor-Overlay
  // (fixed, Tastatur/visualViewport) kann den Zoom der dahinterliegenden Seiten verschieben →
  // beim Zurückkommen sonst „steckende" Seite. syncTick stellt gespeicherten Zoom wieder her bzw.
  // setzt auf Fit.
  const prevShowEditor = useRef(showEditor);
  useEffect(() => {
    if (prevShowEditor.current && !showEditor) setSyncTick((t) => t + 1);
    prevShowEditor.current = showEditor;
  }, [showEditor]);

  const nextSong = activeSongIdx < songs.length - 1 ? songs[activeSongIdx + 1] : null;

  return (
    <Screen className={styles.chartScreen}>
      <>
        {/* Header */}
        <div className={styles.hdr}>
          <button className={styles.ibtn} onClick={onBack} aria-label="Zurück">
            <Icon name="chev-left" size={22} stroke={2.4} />
          </button>
          <div className={styles.center}>
            <button
              className={styles.menuBtn}
              data-tour="chart-lied"
              onClick={() => !viewing && toggleOverlay('menu')}
              aria-haspopup="menu"
              aria-expanded={overlay === 'menu'}
            >
              <span className={styles.menuTitleRow}>
                <span className={styles.songTitle}>{song.title}</span>
                <span className={styles.menuChevron} aria-hidden="true">
                  ▾
                </span>
              </span>
              {headInfo.length > 0 && (
                <span className={styles.menuInfo}>
                  {headInfo.map((part, i) => (
                    <span key={i} className={styles.menuInfoPart}>
                      {i > 0 && <span className={styles.menuInfoDot}>·</span>}
                      {part.art === 'plain' ? (
                        part.text
                      ) : (
                        <span className={part.art === 'key' ? styles.infoKey : styles.infoCapo}>
                          {part.text}
                        </span>
                      )}
                    </span>
                  ))}
                </span>
              )}
            </button>
          </div>
          <div className={styles.right}>
            {!activeDoc && !viewing && (
              <button
                className={`${styles.toolBtn}${overlay === 'appearance' ? ' ' + styles.on : ''}`}
                data-tour="chart-aussehen"
                onClick={() => toggleOverlay('appearance')}
                title="Aussehen"
              >
                Aa
              </button>
            )}
            {streamZoomed && (
              <button
                className={styles.toolBtn}
                onClick={() => setResetZoomSignal((n) => n + 1)}
                title="Zoom zurücksetzen"
                aria-label="Zoom zurücksetzen"
              >
                <Icon name="zoom-reset" size={18} stroke={2} />
              </button>
            )}
            {/* Team-Notizen: geteilte Anmerkungen anderer ansehen (nur Berechtigte). */}
            {canUseGlobalNotes && !activeDoc && (
              <button
                className={`${styles.toolBtn}${viewing ? ' ' + styles.on : ''}`}
                data-tour="chart-team"
                onClick={() => (viewing ? stopViewing() : openSharers())}
                title="Notizen von …"
                aria-label="Notizen von anderen ansehen"
              >
                <Icon name="people" size={18} stroke={2} />
              </button>
            )}
            {!viewing && (
              <button
                className={`${styles.toolBtn}${drawMode ? ' ' + styles.on : ''}`}
                data-tour="chart-anmerken"
                onClick={() => setDrawMode((d) => !d)}
                title="Anmerkungen"
              >
                <Icon name="pencil" size={18} stroke={2.2} />
              </button>
            )}
          </div>
        </div>

        {/* „Notizen von …"-Banner: man sieht gerade die geteilte Ebene einer anderen Person. */}
        {viewing &&
          (() => {
            const vName =
              versions.find((v) => v.key === viewing.versionKey)?.name ?? viewing.versionKey;
            const otherVersion =
              (settings[song.id]?.versionKey ?? 'original') !== viewing.versionKey;
            return (
              <div className={styles.viewBar}>
                <Icon name="people" size={15} stroke={2} />
                <span className={styles.viewBarText}>
                  Notizen von {viewing.name}
                  {' · '}
                  {otherVersion ? <strong>Version „{vName}"</strong> : <>Version „{vName}"</>}
                  {' · '}
                  {viewing.lyr ? 'Nur Text' : 'Akkorde & Text'}
                </span>
              </div>
            );
          })()}

        {/* Aussehen-Menü (pro aktivem Lied: Schriftgröße, Spalten) */}
        {overlay === 'appearance' && (
          <ChartAppearanceMenu
            fontSize={set.fontSize}
            cols={set.cols}
            onFontSize={(fontSize) => updateSetting(song.id, { fontSize })}
            onCols={(cols) => updateSetting(song.id, { cols })}
            onClose={() => setOverlay(null)}
          />
        )}

        {/* Lied-Menü (über den Titel) */}
        {overlay === 'menu' && (
          <SongMenu
            song={song}
            set={set}
            curKey={curKey}
            sections={sections}
            versions={versions}
            currentVersion={currentVersion}
            isOriginal={isOriginal}
            hasVersions={hasVersions}
            canEditSong={canEditSong}
            onClose={() => setOverlay(null)}
            onOpenKeyPicker={() => setOverlay('key')}
            onOpenCapoPicker={() => setOverlay('capo')}
            onOpenSectionTranspose={() => setOverlay('sec')}
            onSharePdf={shareCurrentAsPdf}
            onEditCurrent={openEditCurrent}
            onNewVersion={openNewVersion}
            onDeleteVersion={() => setConfirmDelEdited(true)}
            onChange={(patch) => updateSetting(song.id, patch)}
            onSelectVersion={(versionKey) => selectVersion(song.id, versionKey)}
          />
        )}

        {/* Tonart-Picker */}
        {overlay === 'key' && (
          <KeyPicker
            currentKey={curKey}
            defaultKey={song.targetKey}
            isCustom={set.key !== null}
            onPick={(k) => {
              updateSetting(song.id, { key: k });
              setOverlay(null);
            }}
            onReset={() => {
              updateSetting(song.id, { key: null });
              setOverlay(null);
            }}
            onClose={() => setOverlay(null)}
          />
        )}

        {/* Kapo-Picker */}
        {overlay === 'capo' && (
          <CapoPicker
            capo={set.capo}
            shapeKey={shapeKey}
            soundingKey={curKey}
            onPick={(c) => {
              updateSetting(song.id, { capo: c });
              setOverlay(null);
            }}
            onClose={() => setOverlay(null)}
          />
        )}

        {overlay === 'sec' && (
          <SectionTransposeSheet
            sections={sections}
            value={set.secShift}
            onChange={(index, semitones) => {
              const nextShift = { ...set.secShift };
              if (semitones === 0) delete nextShift[index];
              else nextShift[index] = semitones;
              updateSetting(song.id, { secShift: nextShift });
            }}
            onReset={() => updateSetting(song.id, { secShift: {} })}
            onClose={() => setOverlay(null)}
          />
        )}

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

        {/* Footer */}
        <div className={styles.ftr}>
          <button
            className={styles.navBtn}
            onClick={prev}
            disabled={atStart}
            aria-label="Zurück / vorige Seite"
          >
            <Icon name="chev-left" size={22} stroke={2.4} />
          </button>
          <div className={styles.ftrCenter}>
            {songs.length > 1 && (
              <div className={styles.dots}>
                {songs.map((_, i) => (
                  <div
                    key={i}
                    className={`${styles.dot}${visibleSongIdx.has(i) ? ' ' + styles.on : ''}`}
                    onClick={() => goToSong(i)}
                  />
                ))}
              </div>
            )}
            {nextSong ? (
              <div className={styles.ftrInfo}>
                <span className={styles.ftrNext}>Nächstes Lied: {nextSong.title}</span>
              </div>
            ) : songs.length > 1 ? (
              <div className={styles.ftrInfo}>
                <span className={styles.ftrSong}>Letztes Lied</span>
              </div>
            ) : null}
          </div>
          <button
            className={styles.navBtn}
            onClick={next}
            disabled={atEnd}
            aria-label="Weiter / nächste Seite"
          >
            <Icon name="chev-right" size={22} stroke={2.4} />
          </button>
        </div>

        {/* Team-Notizen: EINE Leiste steuert das Ansehen. „Ansehen" = nur seine Ebene lesend;
            „Zusammenführen"/„Ersetzen" zeigen live die Vorschau, „Übernehmen" schreibt dann wirklich. */}
        {viewing && (
          <div className={styles.previewBar}>
            <span className={styles.pvSegWrap}>
              <button
                className={`${styles.pvSeg}${viewMode === 'view' ? ' ' + styles.pvSegOn : ''}`}
                onClick={() => setViewMode('view')}
              >
                Ansehen
              </button>
              <button
                className={`${styles.pvSeg}${viewMode === 'merge' ? ' ' + styles.pvSegOn : ''}`}
                onClick={() => setViewMode('merge')}
              >
                Zusammenführen
              </button>
              <button
                className={`${styles.pvSeg}${viewMode === 'replace' ? ' ' + styles.pvSegOn : ''}`}
                onClick={() => setViewMode('replace')}
              >
                Ersetzen
              </button>
            </span>
            {viewMode !== 'view' && (
              <>
                <span className={styles.pvDivider} />
                <button className={styles.pvGo} onClick={() => void importFrom(viewMode)}>
                  Übernehmen
                </button>
              </>
            )}
            <button
              className={styles.pvIcon}
              onClick={openSharers}
              title="Andere Person / Ebene"
              aria-label="Andere Person oder Ebene wählen"
            >
              <Icon name="people" size={18} stroke={2} />
            </button>
            <button className={styles.pvCancel} onClick={stopViewing}>
              Fertig
            </button>
          </div>
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
