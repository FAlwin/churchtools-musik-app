import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SetlistSong } from '@shared/types/index';
import { Screen } from '../components/Screen';
import { KeyPicker } from '../components/KeyPicker';
import { CapoPicker } from '../components/CapoPicker';
import { SectionTransposeSheet } from '../components/SectionTransposeSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ChordEditor } from '../components/ChordEditor';
import { PageDeck } from '../components/PageDeck';
import { Coachmarks } from '../components/Coachmarks';
import { CHART_STEPS, TOUR_CHART, isTourDone, markTourDone } from '../utils/onboarding';
import { Icon } from '../components/icons';
import { migrateLocalAnnotations, pullAnnotations, pushField } from '../services/annotations';
import {
  VIEW_NS,
  getSharers,
  getSettingsOf,
  loadViewMirror,
  clearViewMirror,
  type Sharer,
} from '../services/teamNotes';
import { Sheet } from '../components/Sheet';
import { Toast, useToast } from '../components/Toast';
import { migrateLocalSettings, pullSettings, pushSetting } from '../services/userSettings';
import { parseChordPro } from '../utils/chordpro';
import { availableVersions, versionText, setLsVersion } from '../utils/songVersions';
import { getSemitoneOffset, shiftKey } from '../utils/transpose';
import { generateChordPdf, generateSetlistPdfWithOwners } from '../utils/chordPdf';
import { sharePdf } from '../utils/sharePdf';
import { type SongSettings, DEFAULT_SETTINGS, loadSettings, settingsFromMap } from '../utils/chartSettings';
import { logoTightUrl } from '../utils/logoAsset';
import { useChartNavigation } from '../hooks/useChartNavigation';
import { useChartEditor } from '../hooks/useChartEditor';
import { useSetlistPages } from '../hooks/useSetlistPages';
import type { DrawTool, Theme } from '../types/index';
import styles from './ChordChart.module.scss';

interface ChordChartProps {
  songs: SetlistSong[];
  startIndex: number;
  onBack: () => void;
  onReload?: () => void;
  /** Darf der Nutzer den ChordPro-Text bearbeiten? (blendet Editor-Funktionen aus) */
  canEditSong?: boolean;
  /** Darf Team-Notizen nutzen (eigene teilen + geteilte anderer ansehen)? */
  canUseGlobalNotes?: boolean;
  theme: Theme;
  fontId: string;
}

/** Zwei Striche-PNGs (eigene + fremde) zu einem Bild zusammenführen (für den Import). */
function mergeStrokes(own: string | null, theirs: string | null): Promise<string | null> {
  if (!own) return Promise.resolve(theirs ?? null);
  if (!theirs) return Promise.resolve(own);
  return new Promise((resolve) => {
    const a = new Image();
    const b = new Image();
    let loaded = 0;
    const done = () => {
      if (++loaded < 2) return;
      const c = document.createElement('canvas');
      c.width = Math.max(a.naturalWidth, b.naturalWidth);
      c.height = Math.max(a.naturalHeight, b.naturalHeight);
      const ctx = c.getContext('2d');
      if (!ctx || !c.width || !c.height) {
        resolve(own);
        return;
      }
      ctx.drawImage(a, 0, 0);
      ctx.drawImage(b, 0, 0);
      resolve(c.toDataURL('image/png', 0.7));
    };
    a.onload = done;
    b.onload = done;
    a.onerror = done;
    b.onerror = done;
    a.src = own;
    b.src = theirs;
  });
}

/** Textobjekt einer Anmerkungs-Seite (Form wird beim Import 1:1 übernommen). */
interface PageTextObjLike {
  id: number;
  [k: string]: unknown;
}

/** Hat das Konto eigene Anmerkungen auf dieser Ebene (Version + Darstellungsart)? */
function hasOwnNotes(songId: number, versionKey: string, lyr: boolean): boolean {
  const prefix = `worship_docdraw_song${songId}_v${versionKey}${lyr ? '_lyr' : ''}_`;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(prefix)) continue;
    // Nur Seiten-Schlüssel (Striche) bzw. deren _text zählen – keine Fremd-Ebenen-Präfixe.
    const rest = k.slice(prefix.length);
    if (!/^\d+(_text)?$/.test(rest)) continue;
    const v = localStorage.getItem(k);
    if (v && v !== '[]') return true;
  }
  return false;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
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
  // Einstellungen aller Lieder (für den durchgehenden Strom). Aus localStorage initialisiert.
  const [settings, setSettings] = useState<Record<number, SongSettings>>(() =>
    Object.fromEntries(songs.map((s) => [s.id, loadSettings(s)])),
  );
  const songIds = songs.map((s) => s.id).join(',');
  // Signatur über den INHALT aller Versionen → der Strom wird neu erzeugt, sobald sich ein Lied-Text
  // ändert (z. B. nach dem Bearbeiten/Anlegen einer Version), nicht nur bei geänderter Lied-Liste.
  const songsSig = songs
    .map(
      (s) =>
        `${s.id}:${s.chordpro?.length ?? 0}:${s.versions.map((v) => v.key + v.text.length).join('|')}`,
    )
    .join(',');
  useEffect(() => {
    setSettings(Object.fromEntries(songs.map((s) => [s.id, loadSettings(s)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songIds]);

  // Anmerkungen pro Konto: bestehende Geräte-Anmerkungen einmalig hochladen, dann die
  // Server-Anmerkungen dieser Lieder in den lokalen Cache holen und Anzeige neu laden.
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = songs.map((s) => s.id);
      // Erst bestehende lokale Daten einmalig hochladen, dann Server-Stand holen.
      await Promise.all([migrateLocalAnnotations(), migrateLocalSettings()]);
      await Promise.all([pullAnnotations(ids), pullSettings(ids)]);
      // Team-Notizen: wer teilt Anmerkungen zu diesen Liedern? (nur für Berechtigte)
      if (canUseGlobalNotes) {
        getSharers(ids)
          .then((list) => setSharers(list))
          .catch(() => {});
      }
      if (cancelled) return;
      // Einstellungen aus dem (jetzt gespiegelten) localStorage neu übernehmen.
      setSettings(Object.fromEntries(songs.map((s) => [s.id, loadSettings(s)])));
      setSyncTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songIds]);

  function updateSetting(songId: number, patch: Partial<SongSettings>) {
    setSettings((prev) => {
      const cur = prev[songId] ?? DEFAULT_SETTINGS;
      const next = { ...cur, ...patch };
      const vk = next.versionKey;
      if ('key' in patch) setLsVersion('key', songId, vk, next.key);
      if ('capo' in patch) setLsVersion('capo', songId, vk, String(next.capo));
      if ('cols' in patch) setLsVersion('cols', songId, vk, String(next.cols));
      if ('fontSize' in patch) setLsVersion('fs', songId, vk, String(next.fontSize));
      if ('lyricsOnly' in patch) setLsVersion('lyrics', songId, vk, next.lyricsOnly ? '1' : '0');
      // viewSource gilt pro Lied (Dokumentauswahl betrifft das Arrangement, nicht die Version).
      if ('viewSource' in patch) {
        localStorage.setItem(`worship_view_${songId}`, String(next.viewSource));
        pushSetting(`worship_view_${songId}`, String(next.viewSource));
      }
      if ('secShift' in patch) {
        const has = Object.keys(next.secShift).length > 0;
        setLsVersion('secshift', songId, vk, has ? JSON.stringify(next.secShift) : null);
      }
      return { ...prev, [songId]: next };
    });
  }

  /** Wechselt die gewählte Version eines Lieds und lädt deren Einstellungen. */
  function selectVersion(songId: number, versionKey: string) {
    localStorage.setItem(`worship_ver_${songId}`, versionKey);
    pushSetting(`worship_ver_${songId}`, versionKey);
    const s = songs.find((x) => x.id === songId);
    setSettings((prev) => ({ ...prev, [songId]: s ? loadSettings(s, versionKey) : prev[songId] }));
  }

  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [showCapoPicker, setShowCapoPicker] = useState(false);
  const [showSecTranspose, setShowSecTranspose] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showSongMenu, setShowSongMenu] = useState(false);

  const [drawMode, setDrawMode] = useState(false);
  // ── Team-Notizen (#124, PCO-Modell): „Notizen von …" ansehen + übernehmen ──
  // Ansehen gilt PRO LIED (nicht für den ganzen Ablauf) – songId merkt sich, für welches.
  const [viewing, setViewing] = useState<{ id: number; name: string; songId: number } | null>(null);
  const [viewSettings, setViewSettings] = useState<Record<number, SongSettings> | null>(null);
  // Roh-Einstellungen der angesehenen Person (alle worship_*-Schlüssel des Lieds) – für die
  // Ansichts-Übernahme auch dann, wenn eine ANDERE als ihre aktuelle Version importiert wird.
  const [viewRaw, setViewRaw] = useState<Record<string, string> | null>(null);
  // Import-Auswahl: je Ebene (Version+Darstellungsart) die angehakten Seiten.
  const [importSel, setImportSel] = useState<Record<string, number[]>>({});
  const { toast, showToast } = useToast();
  const [sharers, setSharers] = useState<Sharer[]>([]);
  const [showSharers, setShowSharers] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Beim Verlassen der Ansicht/Chart-Wechsel den flüchtigen Ansichts-Spiegel räumen.
  useEffect(() => () => clearViewMirror(), []);
  // Geführte Einführung Chart-Ansicht (#Onboarding, Gruppe 2): startet beim ersten Öffnen, sobald
  // die Seiten gerendert sind (dann existieren die hervorzuhebenden Elemente).
  const [chartTour, setChartTour] = useState(false);
  // Anmerkungs-Farben fest Schwarz/Rot/Gelb (wir arbeiten nur noch auf weißen PDF-Seiten → kein
  // Weiß, kein Dunkelmodus-Wechsel). Plus der freie Farbwähler in der Leiste.
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

  // Vier Anmerkungsfarben (ECG-Palette): Rot, Blau, Grün (Türkis), Orange.
  const drawColors = ['#bb2946', '#0062ac', '#1bb0a2', '#fb8f00'];

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
        setSettings(Object.fromEntries(list.map((s) => [s.id, loadSettings(s)])));
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
    const idContent = setInterval(refreshContent, 60000);
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      clearInterval(id);
      clearInterval(idContent);
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, []);

  // ── „Notizen von …": Während des Ansehens gelten NUR für das angesehene Lied die Einstellungen
  // der angesehenen Person (ihre Ansicht – nur so stimmen die Positionen ihrer Anmerkungen).
  const effSettings: Record<number, SongSettings> =
    viewing && viewSettings
      ? Object.fromEntries(
          songs.map((s) => [
            s.id,
            s.id === viewing.songId ? (viewSettings[s.id] ?? settings[s.id]) : settings[s.id],
          ]),
        )
      : settings;

  /** Ansehen starten – NUR für das übergebene Lied (fremde Ebene + fremde Einstellungen laden). */
  async function startViewing(p: { id: number; name: string }, songId: number) {
    try {
      const target = songs.find((x) => x.id === songId);
      if (!target) return;
      const [, settingsMap] = await Promise.all([
        loadViewMirror(p.id, [songId]),
        getSettingsOf(p.id, [songId]),
      ]);
      setViewSettings({ [songId]: settingsFromMap(target, settingsMap) });
      setViewRaw(settingsMap);
      setViewing({ ...p, songId });
      setDrawMode(false);
      setShowSharers(false);
      setSyncTick((t) => t + 1);
    } catch {
      setShowSharers(false); // Laden gescheitert (offline/Rechte) → still im eigenen Modus bleiben
    }
  }
  function stopViewing() {
    clearViewMirror();
    setViewing(null);
    setViewSettings(null);
    setViewRaw(null);
    setSyncTick((t) => t + 1);
  }
  /** Ebenen (Version + Darstellungsart) mit Anmerkungen im Ansichts-Spiegel, samt Seiten. */
  function mirrorGroups(): Array<{ versionKey: string; lyr: boolean; pages: number[] }> {
    const map = new Map<string, Set<number>>();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(VIEW_NS)) continue;
      const base = k.replace(VIEW_NS, '').replace(/_text$/, '');
      const m = base.match(/^song\d+_v([a-z0-9-]+)(_lyr)?_(\d+)$/i);
      if (!m) continue;
      const gk = `${m[1]}|${m[2] ? '1' : '0'}`;
      if (!map.has(gk)) map.set(gk, new Set());
      map.get(gk)!.add(Number(m[3]));
    }
    return [...map.entries()].map(([gk, pages]) => {
      const [versionKey, lyr] = gk.split('|');
      return { versionKey, lyr: lyr === '1', pages: [...pages].sort((a, b) => a - b) };
    });
  }
  const groupKeyOf = (g: { versionKey: string; lyr: boolean }) => `${g.versionKey}|${g.lyr ? '1' : '0'}`;

  /** Import-Dialog öffnen – vorausgewählt ist die gerade angesehene Ebene (komplett). */
  function openImport() {
    if (!viewing || !viewSettings) return;
    const vs = viewSettings[viewing.songId];
    const sel: Record<string, number[]> = {};
    for (const g of mirrorGroups()) {
      if (vs && g.versionKey === vs.versionKey && g.lyr === vs.lyricsOnly) sel[groupKeyOf(g)] = g.pages;
    }
    setImportSel(sel);
    setShowImport(true);
  }

  /**
   * Import: Anmerkungen der angesehenen Person in die EIGENEN übernehmen (PCO-Stil).
   * „Ersetzen" überschreibt die eigenen Seiten, „Zusammenführen" kombiniert (Striche-PNGs
   * übereinander, Texte angehängt). Die Ansicht (Version/Spalten/Schrift/Nur-Text) der Person
   * wird für die betroffenen Lieder mit übernommen – nur so stimmen die Positionen. Tonart/Kapo
   * bleiben bewusst persönlich.
   */
  async function importFrom(mode: 'merge' | 'replace') {
    if (!viewing || !viewSettings) return;
    setShowImport(false);
    const songId = viewing.songId;
    // Nur die ANGEHAKTEN Ebenen/Seiten übernehmen („man importiert, was man auswählt").
    const selected = Object.entries(importSel).filter(([, pages]) => pages.length > 0);
    if (selected.length === 0) return;
    for (const [gk, pages] of selected) {
      const [versionKey, lyrFlag] = gk.split('|');
      const seg = lyrFlag === '1' ? '_lyr' : '';
      for (const page of pages) {
        const base = `song${songId}_v${versionKey}${seg}_${page}`;
        const theirStrokes = localStorage.getItem(VIEW_NS + base);
        const theirTexts =
          safeParse<PageTextObjLike[]>(localStorage.getItem(`${VIEW_NS + base}_text`)) ?? [];
        const ownKey = `worship_docdraw_${base}`;
        if (mode === 'replace') {
          if (theirStrokes) localStorage.setItem(ownKey, theirStrokes);
          else localStorage.removeItem(ownKey);
          pushField(ownKey, 'strokes', theirStrokes ?? null);
          if (theirTexts.length) localStorage.setItem(`${ownKey}_text`, JSON.stringify(theirTexts));
          else localStorage.removeItem(`${ownKey}_text`);
          pushField(ownKey, 'texts', theirTexts);
        } else {
          const merged = await mergeStrokes(localStorage.getItem(ownKey), theirStrokes);
          if (merged) {
            localStorage.setItem(ownKey, merged);
            pushField(ownKey, 'strokes', merged);
          }
          const ownTexts = safeParse<PageTextObjLike[]>(localStorage.getItem(`${ownKey}_text`)) ?? [];
          const withNewIds = theirTexts.map((t, i) => ({ ...t, id: Date.now() + i }));
          const mergedTexts = [...ownTexts, ...withNewIds];
          if (mergedTexts.length) {
            localStorage.setItem(`${ownKey}_text`, JSON.stringify(mergedTexts));
            pushField(ownKey, 'texts', mergedTexts);
          }
        }
      }
    }
    // Ziel-Ebene = die angesehene Ebene, falls angehakt; sonst die Auswahl mit den meisten Seiten.
    // DIESE Ansicht wird danach angezeigt (Wunsch: was ausgewählt wurde, soll man auch sehen).
    const vs = viewSettings[songId];
    const viewedKey = vs ? `${vs.versionKey}|${vs.lyricsOnly ? '1' : '0'}` : null;
    const primaryKey =
      viewedKey && importSel[viewedKey]?.length
        ? viewedKey
        : [...selected].sort((a, b) => b[1].length - a[1].length)[0][0];
    const [pVersion, pLyr] = primaryKey.split('|');
    // Ansicht der Person für die Ziel-Ebene übernehmen (Spalten/Schrift/Abschnitte aus ihren
    // Roh-Einstellungen der ZIEL-Version; Tonart/Kapo bleiben bewusst eigene).
    const raw = viewRaw ?? {};
    const rawGet = (b: string): string | null => raw[`worship_${b}_${songId}_${pVersion}`] ?? null;
    localStorage.setItem(`worship_ver_${songId}`, pVersion);
    pushSetting(`worship_ver_${songId}`, pVersion);
    setLsVersion('lyrics', songId, pVersion, pLyr === '1' ? '1' : '0');
    setLsVersion('cols', songId, pVersion, rawGet('cols') ?? String(vs?.cols ?? 1));
    setLsVersion('fs', songId, pVersion, rawGet('fs') ?? String(vs?.fontSize ?? 20));
    const rawShift = rawGet('secshift');
    if (rawShift) setLsVersion('secshift', songId, pVersion, rawShift);
    setSettings(Object.fromEntries(songs.map((x) => [x.id, loadSettings(x)])));
    const target = songs.find((x) => x.id === songId);
    const vName =
      (target && availableVersions(target).find((v) => v.key === pVersion)?.name) ?? pVersion;
    stopViewing();
    showToast(
      `Übernommen – Ansicht: Version „${vName}"${pLyr === '1' ? ' · Nur Text' : ''}. Eigene Notizen: siehe Stift-Markierung im Lied-Menü.`,
    );
  }

  /** „Notizen von …" öffnen (Liste beim Öffnen auffrischen). */
  function openSharers() {
    setShowSharers(true);
    getSharers(songs.map((x) => x.id))
      .then((list) => setSharers(list))
      .catch(() => {});
  }

  // ── Durchgehender Seitenstrom: alle Lieder zu EINER PDF (mit Seiten-Besitzer) ──
  const stream = useMemo(() => {
    if (songs.length === 0) return null;
    const songsForPdf = songs.map((s) => {
      const st = effSettings[s.id] ?? loadSettings(s);
      return { ...s, chordpro: versionText(s, st.versionKey), versionKey: st.versionKey };
    });
    const { doc, owners } = generateSetlistPdfWithOwners(songsForPdf, (s) => {
      const st = effSettings[s.id] ?? loadSettings(s);
      const off = getSemitoneOffset(s.originalKey, st.key || s.targetKey) - st.capo;
      return {
        semitones: off,
        cols: st.cols,
        fontPt: Math.max(8, Math.round(st.fontSize * 0.6)),
        lyricsOnly: st.lyricsOnly,
        sectionSemitones: st.secShift,
        displayKey: st.key || s.targetKey,
        logo: logoImg,
      };
    });
    return { data: doc.output('arraybuffer') as ArrayBuffer, owners };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songsSig, effSettings, logoImg]);

  // Durchgehender Strom: Akkord- UND Dokument-Seiten in Setlist-Reihenfolge zu EINER Seiten-Liste
  // (jedes Lied steuert je nach viewSource seine Akkorde ODER sein hochgeladenes Dokument bei).
  const {
    pages,
    owners,
    loading: pagesLoading,
    error: pagesError,
  } = useSetlistPages({
    chordPdfData: stream?.data ?? null,
    chordOwners: stream?.owners ?? [],
    songs,
    settings: effSettings,
  });

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
  // Personen, die Anmerkungen ZUM AKTIVEN Lied teilen (für den Wähler).
  const songSharers = sharers.filter((p) => p.songs.includes(song.id));

  // Aktuell SICHTBARE Lieder (fürs Fußzeilen-Punkte-Highlight): im Querformat 2 Seiten → bis zu
  // 2 Lieder nebeneinander, beide markieren. matchMedia('orientation') ist beim Wechsel stabil.
  const [landscape, setLandscape] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(orientation: landscape)').matches
      : typeof window !== 'undefined'
        ? window.innerWidth > window.innerHeight
        : false,
  );
  useEffect(() => {
    const f = () =>
      setLandscape(
        typeof window.matchMedia === 'function'
          ? window.matchMedia('(orientation: landscape)').matches
          : window.innerWidth > window.innerHeight,
      );
    window.addEventListener('resize', f);
    window.addEventListener('orientationchange', f);
    return () => {
      window.removeEventListener('resize', f);
      window.removeEventListener('orientationchange', f);
    };
  }, []);
  const visibleSongIdx = new Set<number>();
  if (owners[pageIdx]) visibleSongIdx.add(owners[pageIdx].songIdx);
  if (landscape && owners[pageIdx + 1]) visibleSongIdx.add(owners[pageIdx + 1].songIdx);
  if (visibleSongIdx.size === 0) visibleSongIdx.add(activeSongIdx);

  // ── abgeleitete Werte des AKTIVEN Lieds ──
  const curKey = set.key || song.targetKey;
  const totalOffset = getSemitoneOffset(song.originalKey, curKey);
  const shapeKey = shiftKey(curKey, -set.capo);
  // Versionen: Original + benannte; aktuell gewählte ableiten.
  const versions = availableVersions(song);
  const currentVersion = versions.find((v) => v.key === set.versionKey) ?? versions[0];
  const isOriginal = currentVersion.key === 'original';
  const hasVersions = song.versions.length > 0;
  const displayedChordpro = currentVersion.text;
  const sections = parseChordPro(displayedChordpro);
  const editorTemplate = `{title: ${song.title}}\n{key: ${song.targetKey || song.originalKey || 'C'}}\n\n{comment: Vers 1}\n[${song.targetKey || 'C'}]Hier Text mit Akkorden eingeben\n\n{comment: Chorus}\n`;

  const activeDoc =
    set.viewSource === 'chords'
      ? null
      : (song.documents.find((d) => d.fileId === set.viewSource) ?? null);

  // Anmerkungs-/Zoom-Schlüssel je Strom-Seite – Schema identisch zu vorher (Akkorde an Lied+Version,
  // Dokumente an Datei-ID), damit bestehende Anmerkungen erhalten bleiben.
  const drawKeyFor = (page: number): string | null => {
    const o = owners[page];
    if (!o) return null;
    return o.kind === 'doc'
      ? `worship_docdraw_${o.fileId}_${o.localPage}`
      : `worship_docdraw_song${o.songId}_v${o.versionKey}_${o.localPage}`;
  };
  // „Notizen von …": Schlüssel der angesehenen fremden Ebene je Seite (nur Akkord-Seiten;
  // stabile Identität für PageDeck-Effekte). Die Versions-Schlüssel stammen aus der Ansicht der
  // angesehenen Person (effSettings) und passen daher zu ihren Anmerkungs-Schlüsseln.
  const viewingId = viewing?.id ?? null;
  const viewingSongId = viewing?.songId ?? null;
  const viewKeyFor = useCallback(
    (page: number): string | null => {
      if (viewingId == null) return null;
      const o = owners[page];
      if (!o || o.kind === 'doc' || o.songId !== viewingSongId) return null;
      const lyr = viewSettings?.[o.songId]?.lyricsOnly ? '_lyr' : '';
      return `${VIEW_NS}song${o.songId}_v${o.versionKey}${lyr}_${o.localPage}`;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owners, viewingId, viewingSongId, viewSettings],
  );
  const zoomKeyBaseFor = (page: number): string => {
    const o = owners[page];
    if (!o) return `worship_doczoom_p${page}`;
    return o.kind === 'doc'
      ? `worship_doczoom_${o.fileId}_${o.localPage}`
      : `worship_doczoom_song${o.songId}_v${o.versionKey}_${o.localPage}`;
  };
  // Seiten-Hinweis nur bei mehrseitigen Einheiten (Lied/Dokument): „Seite x / y".
  const pageLabel = (activePg: number, pageIdx: number): string | null => {
    const cur = owners[activePg] ?? owners[pageIdx];
    if (!cur) return null;
    const unitPages = owners.filter((o) => o.songIdx === cur.songIdx).length;
    if (unitPages <= 1) return null;
    return `Seite ${cur.localPage + 1} / ${unitPages}`;
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

  // Info-Zeile im Kopf-Button: Tonart/Capo/Version/Tempo bzw. Dokument-Hinweis – je nach Anzeige.
  const headInfo: ReactNode[] = [];
  if (activeDoc) {
    headInfo.push(activeDoc.type === 'pdf' ? 'PDF' : 'Bild');
  } else {
    if (!set.lyricsOnly) headInfo.push(<span className={styles.infoKey}>{curKey}</span>);
    if (set.lyricsOnly) headInfo.push('Nur Text');
    if (!set.lyricsOnly && set.capo > 0)
      headInfo.push(<span className={styles.infoCapo}>Capo {set.capo}</span>);
    if (hasVersions) headInfo.push(currentVersion.name);
    if (song.bpm !== null) headInfo.push(`♩ ${song.bpm}`);
  }

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
              onClick={() => !viewing && setShowSongMenu((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={showSongMenu}
            >
              <span className={styles.menuTitleRow}>
                <span className={styles.songTitle}>{song.title}</span>
                <span className={styles.menuChevron} aria-hidden="true">
                  ▾
                </span>
              </span>
              {headInfo.length > 0 && (
                <span className={styles.menuInfo}>
                  {headInfo.map((node, i) => (
                    <span key={i} className={styles.menuInfoPart}>
                      {i > 0 && <span className={styles.menuInfoDot}>·</span>}
                      {node}
                    </span>
                  ))}
                </span>
              )}
            </button>
          </div>
          <div className={styles.right}>
            {!activeDoc && !viewing && (
              <button
                className={`${styles.toolBtn}${showAppearance ? ' ' + styles.on : ''}`}
                data-tour="chart-aussehen"
                onClick={() => setShowAppearance((v) => !v)}
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
            const vs = viewSettings?.[viewing.songId];
            const vName = vs
              ? (availableVersions(song).find((v) => v.key === vs.versionKey)?.name ?? vs.versionKey)
              : '';
            const otherVersion = vs && (settings[song.id]?.versionKey ?? 'original') !== vs.versionKey;
            return (
              <div className={styles.viewBar}>
                <Icon name="people" size={15} stroke={2} />
                <span className={styles.viewBarText}>
                  Notizen von {viewing.name}
                  {vs && (
                    <>
                      {' · '}
                      {otherVersion ? <strong>Version „{vName}"</strong> : <>Version „{vName}"</>}
                      {' · '}
                      {vs.lyricsOnly ? 'Nur Text' : 'Akkorde & Text'}
                    </>
                  )}
                </span>
                <button className={styles.viewBarBtn} onClick={openImport}>
                  Übernehmen
                </button>
                <button className={styles.viewBarBtn} onClick={stopViewing}>
                  Fertig
                </button>
              </div>
            );
          })()}

        {/* Aussehen-Dropdown (pro aktivem Lied: Schriftgröße, Spalten) */}
        {showAppearance && (
          <>
            <div className={styles.scrim} onClick={() => setShowAppearance(false)} />
            <div className={styles.appMenu}>
              <div className={styles.menuLbl}>Schriftgröße</div>
              <div className={styles.appRow}>
                <button
                  className={styles.stepBtn}
                  onClick={() =>
                    updateSetting(song.id, { fontSize: Math.max(12, set.fontSize - 2) })
                  }
                >
                  A−
                </button>
                <span className={styles.stepValue}>{set.fontSize}</span>
                <button
                  className={styles.stepBtn}
                  onClick={() =>
                    updateSetting(song.id, { fontSize: Math.min(40, set.fontSize + 2) })
                  }
                >
                  A+
                </button>
              </div>

              <div className={styles.menuLbl}>Spalten</div>
              <div className={styles.segGroup}>
                <button
                  className={`${styles.segBtn}${set.cols === 1 ? ' ' + styles.on : ''}`}
                  onClick={() => updateSetting(song.id, { cols: 1 })}
                >
                  1 Spalte
                </button>
                <button
                  className={`${styles.segBtn}${set.cols === 2 ? ' ' + styles.on : ''}`}
                  onClick={() => updateSetting(song.id, { cols: 2 })}
                >
                  2 Spalten
                </button>
              </div>
            </div>
          </>
        )}

        {/* Lied-Menü (über den Titel) */}
        {showSongMenu && (
          <>
            <div className={styles.scrim} onClick={() => setShowSongMenu(false)} />
            <div className={styles.modeMenu}>
              <button
                className={styles.mmItem}
                onClick={() => {
                  setShowKeyPicker(true);
                  setShowSongMenu(false);
                }}
              >
                <span>Transponieren</span>
                <span className={styles.mmValueActive}>{curKey}</span>
              </button>
              <button
                className={styles.mmItem}
                onClick={() => {
                  setShowCapoPicker(true);
                  setShowSongMenu(false);
                }}
              >
                <span>Kapo</span>
                {set.capo > 0 ? (
                  <span className={styles.mmValueActive}>Bund {set.capo}</span>
                ) : (
                  <span className={styles.mmValue}>–</span>
                )}
              </button>
              {set.viewSource === 'chords' && (
                <button
                  className={styles.mmItem}
                  onClick={() => {
                    setShowSecTranspose(true);
                    setShowSongMenu(false);
                  }}
                >
                  <span>Abschnitte transponieren</span>
                  {Object.keys(set.secShift).length > 0 ? (
                    <span className={styles.mmValueActive}>
                      {Object.keys(set.secShift).length} aktiv
                    </span>
                  ) : (
                    <span className={styles.mmValue}>–</span>
                  )}
                </button>
              )}
              {set.viewSource === 'chords' && sections.length > 0 && (
                <button
                  className={styles.mmItem}
                  onClick={() => {
                    setShowSongMenu(false);
                    const doc = generateChordPdf(
                      { ...song, chordpro: displayedChordpro },
                      {
                        semitones: totalOffset,
                        cols: set.cols,
                        fontPt: Math.max(8, Math.round(set.fontSize * 0.6)),
                        lyricsOnly: set.lyricsOnly,
                        sectionSemitones: set.secShift,
                        displayKey: curKey,
                        logo: logoImg,
                      },
                    );
                    void sharePdf(doc, song.title);
                  }}
                >
                  <span>Als PDF teilen</span>
                  <span className={styles.mmValue}>⤴</span>
                </button>
              )}
              {canEditSong && set.viewSource === 'chords' && (
                <button
                  className={styles.mmItem}
                  onClick={() => {
                    openEditCurrent();
                    setShowSongMenu(false);
                  }}
                >
                  <span>
                    {isOriginal
                      ? 'Bearbeiten (neue Version)'
                      : `„${currentVersion.name}" bearbeiten`}
                  </span>
                  <span className={styles.mmValue}>🖉</span>
                </button>
              )}

              <div className={styles.menuLbl} style={{ marginTop: 6 }}>
                Anzeige
              </div>
              <button
                className={`${styles.mmItem}${set.viewSource === 'chords' && !set.lyricsOnly ? ' ' + styles.on : ''}`}
                onClick={() => {
                  updateSetting(song.id, { viewSource: 'chords', lyricsOnly: false });
                  setShowSongMenu(false);
                }}
              >
                <span>
                  Akkorde &amp; Text
                  {hasOwnNotes(song.id, set.versionKey, false) && (
                    <Icon name="pencil" size={12} className={styles.mmNote} />
                  )}
                </span>
                {set.viewSource === 'chords' && !set.lyricsOnly && (
                  <span className={styles.mmCheck}>✓</span>
                )}
              </button>
              <button
                className={`${styles.mmItem}${set.viewSource === 'chords' && set.lyricsOnly ? ' ' + styles.on : ''}`}
                onClick={() => {
                  updateSetting(song.id, { viewSource: 'chords', lyricsOnly: true });
                  setShowSongMenu(false);
                }}
              >
                <span>
                  Nur Text
                  {hasOwnNotes(song.id, set.versionKey, true) && (
                    <Icon name="pencil" size={12} className={styles.mmNote} />
                  )}
                </span>
                {set.viewSource === 'chords' && set.lyricsOnly && (
                  <span className={styles.mmCheck}>✓</span>
                )}
              </button>
              {song.documents.map((d) => (
                <button
                  key={d.fileId}
                  className={`${styles.mmItem}${set.viewSource === d.fileId ? ' ' + styles.on : ''}`}
                  onClick={() => {
                    updateSetting(song.id, { viewSource: d.fileId });
                    setShowSongMenu(false);
                  }}
                >
                  <span>
                    {d.type === 'pdf' ? '📄' : '🖼️'} {d.name}
                  </span>
                  {set.viewSource === d.fileId && <span className={styles.mmCheck}>✓</span>}
                </button>
              ))}

              {set.viewSource === 'chords' && (hasVersions || canEditSong) && (
                <>
                  <div className={styles.menuLbl} style={{ marginTop: 6 }}>
                    Version
                  </div>
                  {versions.map((v) => (
                    <button
                      key={v.key}
                      className={`${styles.mmItem}${set.versionKey === v.key ? ' ' + styles.on : ''}`}
                      onClick={() => {
                        selectVersion(song.id, v.key);
                        setShowSongMenu(false);
                      }}
                    >
                      <span>
                        {v.name}
                        {(hasOwnNotes(song.id, v.key, false) || hasOwnNotes(song.id, v.key, true)) && (
                          <Icon name="pencil" size={12} className={styles.mmNote} />
                        )}
                      </span>
                      {set.versionKey === v.key && <span className={styles.mmCheck}>✓</span>}
                    </button>
                  ))}
                  {canEditSong && (
                    <button
                      className={styles.mmItem}
                      onClick={() => {
                        openNewVersion();
                        setShowSongMenu(false);
                      }}
                    >
                      <span>Neue Version…</span>
                      <span className={styles.mmValue}>＋</span>
                    </button>
                  )}
                  {canEditSong && !isOriginal && (
                    <button
                      className={styles.mmItem}
                      onClick={() => {
                        setShowSongMenu(false);
                        setConfirmDelEdited(true);
                      }}
                    >
                      <span className={styles.mmDanger}>„{currentVersion.name}" löschen</span>
                      <span className={styles.mmValue}>🗑</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* Tonart-Picker */}
        {showKeyPicker && (
          <KeyPicker
            currentKey={curKey}
            defaultKey={song.targetKey}
            isCustom={set.key !== null}
            onPick={(k) => {
              updateSetting(song.id, { key: k });
              setShowKeyPicker(false);
            }}
            onReset={() => {
              updateSetting(song.id, { key: null });
              setShowKeyPicker(false);
            }}
            onClose={() => setShowKeyPicker(false)}
          />
        )}

        {/* Kapo-Picker */}
        {showCapoPicker && (
          <CapoPicker
            capo={set.capo}
            shapeKey={shapeKey}
            soundingKey={curKey}
            onPick={(c) => {
              updateSetting(song.id, { capo: c });
              setShowCapoPicker(false);
            }}
            onClose={() => setShowCapoPicker(false)}
          />
        )}

        {showSecTranspose && (
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
            onClose={() => setShowSecTranspose(false)}
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
              drawColors={drawColors}
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

        {/* „Notizen von …": wer teilt Anmerkungen zu den Liedern dieses Ablaufs? */}
        {showSharers && (
          <Sheet title="Notizen von …" onClose={() => setShowSharers(false)} cancelLabel="Schließen">
            <p className={styles.pickHint}>
              Zeigt die geteilten Anmerkungen einer Person zu „{song.title}" – in ihrer Ansicht,
              schreibgeschützt. Über „Übernehmen" kannst du sie in deine eigenen Notizen kopieren.
            </p>
            {songSharers.length === 0 ? (
              <p className={styles.pickHint}>Zurzeit teilt niemand Anmerkungen zu diesem Lied.</p>
            ) : (
              songSharers.map((p) => (
                <button
                  key={p.id}
                  className={styles.pickRow}
                  onClick={() => void startViewing(p, song.id)}
                >
                  <Icon name="people" size={18} stroke={2} />
                  <span className={styles.pickName}>{p.name}</span>
                </button>
              ))
            )}
          </Sheet>
        )}

        {/* Import-Auswahl: welche Ebenen/Seiten übernehmen, dann Zusammenführen oder Ersetzen. */}
        {showImport && viewing && (
          <Sheet title="Notizen übernehmen" onClose={() => setShowImport(false)}>
            <p className={styles.pickHint}>
              Wähle aus, welche Anmerkungen von {viewing.name} du übernehmen willst (angezeigt sind
              nur Ebenen mit Anmerkungen). Übernommen wird auch die zugehörige Ansicht – sie wird
              danach angezeigt. Deine eigenen Notizen anderer Versionen/Darstellungen bleiben
              gespeichert (Stift-Markierung im Lied-Menü). Deine Tonart bleibt erhalten.
            </p>
            {mirrorGroups().map((g) => {
              const gk = groupKeyOf(g);
              const sel = importSel[gk] ?? [];
              const vName =
                availableVersions(song).find((v) => v.key === g.versionKey)?.name ?? g.versionKey;
              const allOn = sel.length === g.pages.length;
              return (
                <div key={gk} className={styles.impGroup}>
                  <button
                    className={styles.impGroupHead}
                    role="checkbox"
                    aria-checked={allOn}
                    onClick={() =>
                      setImportSel((prev) => ({ ...prev, [gk]: allOn ? [] : g.pages }))
                    }
                  >
                    <span className={`${styles.impCheck}${allOn ? ' ' + styles.impCheckOn : ''}`}>
                      {allOn && <Icon name="check" size={12} />}
                    </span>
                    <span className={styles.impGroupName}>
                      Version „{vName}" · {g.lyr ? 'Nur Text' : 'Akkorde & Text'}
                    </span>
                  </button>
                  <div className={styles.impPages}>
                    {g.pages.map((pg) => {
                      const on = sel.includes(pg);
                      return (
                        <button
                          key={pg}
                          className={`${styles.impPage}${on ? ' ' + styles.impPageOn : ''}`}
                          role="checkbox"
                          aria-checked={on}
                          onClick={() =>
                            setImportSel((prev) => ({
                              ...prev,
                              [gk]: on ? sel.filter((x) => x !== pg) : [...sel, pg].sort((a, b) => a - b),
                            }))
                          }
                        >
                          Seite {pg + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <button
              className={`${styles.importBtn} ${styles.importPrimary}`}
              disabled={Object.values(importSel).every((p) => p.length === 0)}
              onClick={() => void importFrom('merge')}
            >
              Zusammenführen (zu meinen hinzufügen)
            </button>
            <button
              className={styles.importBtn}
              disabled={Object.values(importSel).every((p) => p.length === 0)}
              onClick={() => void importFrom('replace')}
            >
              Ersetzen (Auswahl überschreibt meine)
            </button>
          </Sheet>
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
