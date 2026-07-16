import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import type { DrawTool } from '../types/index';
import {
  usePageDraw,
  type PageTextObj,
  type TextStyle,
  DEFAULT_TEXT_STYLE,
} from '../hooks/usePageDraw';
import { pushField } from '../services/annotations';
import { useZoomPersistence } from '../hooks/useZoomPersistence';
import { useKeyboardInsets } from '../hooks/useKeyboardInsets';
import { useSlideTransition, type SlideSlot } from '../hooks/useSlideTransition';
import { DrawToolbar } from './DrawToolbar';
import { ConfirmDialog } from './ConfirmDialog';
import { Spinner } from './Spinner';
import styles from './PageDeck.module.scss';

const MIN_SCALE = 1;
const MAX_SCALE = 6;

export interface PageDeckProps {
  /** Fertig gerenderte Seiten (offscreen-Canvas). Der aufrufende Loader liefert sie. */
  pages: HTMLCanvasElement[];
  loading: boolean;
  error: string | null;
  /** Text unter dem Spinner während des Ladens. */
  loadingLabel: string;
  /** localStorage-Schlüssel für Anmerkungen (Striche+Text) einer Seite – oder null (nicht speicherbar). */
  drawKeyFor: (page: number) => string | null;
  /**
   * „Notizen von …"-Ansehen (Team-Notizen, PCO-Modell): Schlüssel der GERADE ANGESEHENEN fremden
   * Ebene einer Seite – null = normale eigene Anzeige. Ist ein Schlüssel gesetzt, zeigt die Seite
   * die fremde Ebene SCHREIBGESCHÜTZT statt der eigenen Anmerkungen. MUSS eine stabile Identität
   * haben (useCallback) – steckt in Effekt-Abhängigkeiten.
   */
  viewKeyFor?: (page: number) => string | null;
  /**
   * Import-Vorschau „Zusammenführen": Während des Ansehens die EIGENE Ebene zusätzlich zeigen
   * (fremde Overlay + eigene übereinander = das Ergebnis des Zusammenführens, live).
   */
  previewOwn?: boolean;
  /** Basis-Schlüssel für den gespeicherten Zoom einer Seite (ohne Layout-Suffix – das hängt PageDeck an). */
  zoomKeyBaseFor: (page: number) => string;
  /** Optionaler Seiten-Hinweis unten rechts (z. B. „Seite 1 / 3"). null = nicht anzeigen. */
  pageLabel?: (activePage: number, pageIndex: number, pageCount: number) => string | null;
  /** Wenn gesetzt, ist das Seiten-Badge klickbar (blättert weiter). */
  onBadgeClick?: () => void;
  /** Wischen/Tippen über die erste Seite hinaus (z. B. voriges Lied). Fehlt = am Rand stehen bleiben. */
  onBeforeFirst?: () => void;
  /** Wischen/Tippen über die letzte Seite hinaus (z. B. nächstes Lied). Fehlt = am Rand stehen bleiben. */
  onAfterLast?: () => void;

  pageIndex: number;
  onPageIndex: (i: number) => void;
  activePage: number;
  onActivePage: (i: number) => void;

  drawMode: boolean;
  drawColor: string;
  setDrawColor: (c: string) => void;
  drawTool: DrawTool;
  setDrawTool: (t: DrawTool) => void;
  drawColors: string[];
  /** Erhöht sich nach einem Server-Sync der Anmerkungen → Striche/Texte/Zoom neu aus localStorage laden. */
  syncTick?: number;
  /** Meldet nach oben, ob gerade eine sichtbare Seite reingezoomt ist (für den Reset-Knopf in der Kopfleiste). */
  onZoomedChange?: (zoomed: boolean) => void;
  /** Erhöht sich, wenn der Reset-Knopf der Kopfleiste gedrückt wird → sichtbaren Zoom zurücksetzen. */
  resetZoomSignal?: number;
}

// Stabiler Default für `viewKeyFor` (kein Ansehen) – Identität darf sich nie ändern,
// weil die Funktion in Effekt-Abhängigkeiten steckt.
const NO_VIEW = (): string | null => null;

function isLandscape(): boolean {
  // matchMedia('orientation') ist beim Screen-Wechsel/SPA-Navigation stabiler als innerWidth/Height
  // (die kurzzeitig falsch gemeldet werden) → verhindert, dass der Zoom-Schlüssel (perView) kippt
  // und der gespeicherte Zoom beim Wieder-Betreten erst „falsch" erscheint und dann springt.
  if (typeof window.matchMedia === 'function')
    return window.matchMedia('(orientation: landscape)').matches;
  return window.innerWidth > window.innerHeight;
}

/**
 * Gemeinsame 2-Seiten-Engine für ChordPro-Strom (StreamView) UND hochgeladene PDFs/Bilder
 * (DocumentView). Hochformat 1 Seite, Querformat IMMER 2 Seiten nebeneinander – jede Seite ein
 * eigener Bereich mit eigenem Zoom (dauerhaft gespeichert) und vollen Anmerkungen (Stift/Marker/
 * Radierer + Textfelder + Rückgängig).
 *
 * Anmerken im 2-up (#53): Nur die AKTIVE Seite ist beschreibbar und dezent hervorgehoben; die
 * inaktive Seite ist ausgegraut und gegen Anmerkungen gesperrt. Ein Tipp auf die inaktive Seite
 * macht sie aktiv (setzt dabei keinen Strich).
 */
export function PageDeck({
  pages,
  loading,
  error,
  loadingLabel,
  drawKeyFor,
  viewKeyFor = NO_VIEW,
  previewOwn = false,
  zoomKeyBaseFor,
  pageLabel,
  onBadgeClick,
  onBeforeFirst,
  onAfterLast,
  pageIndex,
  onPageIndex,
  activePage,
  onActivePage,
  drawMode,
  drawColor,
  setDrawColor,
  drawTool,
  setDrawTool,
  drawColors,
  syncTick = 0,
  onZoomedChange,
  resetZoomSignal = 0,
}: PageDeckProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Inline-Texteingabe direkt auf der Seite (blinkender Cursor statt separater Leiste).
  const editRefs = useRef<(HTMLSpanElement | null)[]>([null, null]);
  const textCommitLock = useRef<[boolean, boolean]>([false, false]); // gegen Doppel-Commit (Blur + Tipp)
  // Zieh-Knopf am Auswahlrahmen: Startgröße + Start-Y + Ebenenhöhe für die Größenänderung.
  const resizeDrag = useRef<{
    slot: number;
    id: number;
    startY: number;
    startSize: number;
    layerH: number;
  } | null>(null);
  const contentRefs = [
    useRef<HTMLCanvasElement | null>(null),
    useRef<HTMLCanvasElement | null>(null),
  ];
  const annoRefs = [useRef<HTMLCanvasElement | null>(null), useRef<HTMLCanvasElement | null>(null)];
  // Schreibgeschützte Striche des jeweils ANDEREN Bereichs (Team-Ebene bzw. beim Team-Bearbeiten
  // die privaten) – eigene Canvas UNTER der interaktiven Anno-Canvas.
  const overlayRefs = [
    useRef<HTMLCanvasElement | null>(null),
    useRef<HTMLCanvasElement | null>(null),
  ];
  const layerRefs = [useRef<HTMLDivElement | null>(null), useRef<HTMLDivElement | null>(null)];
  const transformRefs = [
    useRef<ReactZoomPanPinchRef | null>(null),
    useRef<ReactZoomPanPinchRef | null>(null),
  ];
  // Letzter Zoom-Faktor je Slot – um „aktives Herauszoomen" von programmatischem Reset zu unterscheiden.
  const lastScale = useRef<[number, number]>([1, 1]);
  // Marker glatt: aktiver Strich wird als EINE Linie aus allen Punkten neu gezeichnet (auf einem
  // Schnappschuss der Seite vor dem Strich) → keine pro-Segment-Überlagerung mehr (kein „Gepunktel").
  const markerBase = useRef<HTMLCanvasElement | null>(null);
  const markerPts = useRef<{ x: number; y: number }[]>([]);
  const stroke = useRef(false);
  const strokePointer = useRef(-1);
  const strokePointerType = useRef<string>('');
  const strokeCanvas = useRef<HTMLCanvasElement | null>(null);
  const strokeSlot = useRef(0);
  // Schnappschuss der Anno-Canvas VOR dem Strich → um einen begonnenen Strich zu verwerfen, wenn
  // ein zweiter Finger dazukommt (dann war es eine Zoom-/Verschiebe-Geste, kein Zeichnen).
  const strokeSnapshot = useRef<HTMLCanvasElement | null>(null);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false); // verhindert doppelte Navigation (Touch löst auch click aus)
  // Slot, den der Nutzer GERADE per Geste anpasst. Synchron (Ref, nicht State) → das erste
  // onTransformed einer Geste sieht den korrekten Slot, und programmatisches Wiederherstellen
  // (setTransform/resetTransform) schreibt NICHT fälschlich zurück.
  // WICHTIG: wird am GESTEN-ENDE (onZoomStop, leicht verzögert) wieder freigegeben. Bliebe er
  // stehen, würden (a) spätere programmatische Neuausrichtungen (z. B. nach dem 30-Sekunden-Sync)
  // den Speicher-Guard passieren und den gespeicherten Zoom fälschlich LÖSCHEN und (b) die
  // Wiederherstell-Effekte genau diesen Slot dauerhaft überspringen → „Zoom bleibt nicht".
  const gestureSlot = useRef<number | null>(null);
  const gestureEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [landscape, setLandscape] = useState(isLandscape());
  // Wird bei App-Rückkehr hochgezählt → erzwingt einen sauberen Remount der Zoom-Ebenen (steckt im
  // TransformWrapper-key), damit ein nach dem Backgrounding veralteter Zoom-Zustand aufgelöst wird.
  const [remountEpoch, setRemountEpoch] = useState(0);
  // Welche sichtbaren Seiten gerade reingezoomt sind (auch geladener Zoom) → steuert Panning,
  // Wisch-Navigation und den Zoom-Reset-Knopf. Kein „Anpassen-Modus"/„Fertig" mehr nötig – ein
  // Pinch zoomt und speichert automatisch; Verschieben ist möglich, sobald reingezoomt.
  const [zoomedSlots, setZoomedSlots] = useState<[boolean, boolean]>([false, false]);
  // Vorab dekodierte Strich-Bilder der Nachbarseiten (localStorage-PNGs) für den Streifen.
  const strokeImgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [aspects, setAspects] = useState<string[]>(['210 / 297', '210 / 297']);
  const [textSize, setTextSize] = useState(1.5); // cqh = % der Seitenhöhe (~13 pt, nahe der Liedtext-Größe)
  // Aktueller „Pinsel"-Stil für NEU platzierten Text (bei ausgewähltem Text wirken die Format-
  // Knöpfe direkt auf das Objekt via dr_.setStyle). Startet normal & mittig (DEFAULT_TEXT_STYLE).
  const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  // Strichstärke je Werkzeug (Canvas-Pixel bei Renderskala 2) – einstellbar über die Werkzeugleiste.
  const [toolSizes, setToolSizes] = useState({ pen: 3, marker: 18, eraser: 26 });
  const [confirmClear, setConfirmClear] = useState(false);

  const pageCount = pages.length;
  const perView = landscape ? 2 : 1;

  // Dauerhaftes Speichern/Laden des Pinch-Zooms pro Seite (Geräteklasse + Layout im Schlüssel) –
  // ausgelagert in useZoomPersistence. Die Apply-Effekte (Wiederherstellen) bleiben unten in PageDeck.
  const { loadZoom, persistZoom, resetVisibleZoom, restoreVisibleZoom } = useZoomPersistence({
    zoomKeyBaseFor,
    perView,
    pageIndex,
    transformRefs,
    lastScale,
    gestureSlot,
    zoomedSlots,
  });

  // ── „Notizen von …"-Ansehen (Team-Notizen) ──
  // Ist für eine Seite ein Ansichts-Schlüssel gesetzt, wird DIE FREMDE Ebene (Overlay, nur lesend)
  // gezeigt und die eigene ausgeblendet. Bearbeitet wird immer nur die eigene (private) Ebene.
  const overlayKeyFor = (p: number): string | null => viewKeyFor(p);
  const viewing = (p: number): boolean => overlayKeyFor(p) != null;

  // Ein Anmerkungs-Zustand je sichtbarer Seite (fixe Anzahl Hooks – Regeln der Hooks).
  const drawA = usePageDraw(drawKeyFor(pageIndex), annoRefs[0], layerRefs[0], syncTick, pushField);
  const drawB = usePageDraw(
    drawKeyFor(pageIndex + 1),
    annoRefs[1],
    layerRefs[1],
    syncTick,
    pushField,
  );
  const draws = [drawA, drawB];
  const activeSlot = Math.max(0, Math.min(perView - 1, activePage - pageIndex));
  const activeDraw = draws[activeSlot];

  // Texte des Overlay-Bereichs (nur lesend) je sichtbarem Slot – direkt aus localStorage.
  // Ändert sich nur durch Sync (syncTick), Blättern oder Bereichs-/Augen-Wechsel.
  const overlayTexts: PageTextObj[][] = useMemo(() => {
    const out: PageTextObj[][] = [[], []];
    if (loading) return out;
    for (let j = 0; j < 2; j++) {
      const key = overlayKeyFor(pageIndex + j);
      if (!key) continue;
      try {
        const t = localStorage.getItem(`${key}_text`);
        out[j] = t ? (JSON.parse(t) as PageTextObj[]) : [];
      } catch {
        out[j] = [];
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, syncTick, viewKeyFor, loading]);

  // Anmerkungsmodus verlassen → Text-Auswahl aufheben. Sonst bliebe der gestrichelte Rahmen des
  // zuletzt bearbeiteten Textes stehen (er hängt an selectedId) und verschwände erst beim
  // nächsten Seitenwechsel.
  useEffect(() => {
    if (!drawMode) {
      drawA.setSelectedId(null);
      drawB.setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawMode]);

  // Wechselt die AKTIVE Hälfte (2-up), darf auf der nun inaktiven keine Auswahl/Eingabe
  // zurückbleiben – sonst stehen Auswahlrahmen auf beiden Seiten gleichzeitig. Eine offene
  // Inline-Eingabe dort wird zuerst übernommen (nichts geht verloren).
  useEffect(() => {
    if (perView !== 2) return;
    const other = activeSlot === 0 ? 1 : 0;
    if (draws[other].pending) commitInlineText(other);
    draws[other].setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlot, perView]);

  useEffect(() => {
    const onResize = () => setLandscape(isLandscape());
    // Bei App-Rückkehr (iOS-PWA) kann der Container neu vermessen worden sein, ohne dass sich die
    // Ausrichtung (perView) ändert → die Zoom-Ebene bliebe mit einem veralteten Transform „stecken".
    // Ein Epoche-Hochzählen erzwingt einen sauberen Remount der Zoom-Ebenen (onInit stellt den
    // gespeicherten Zoom des aktuellen Layouts frisch her). Nur im Vordergrund. Committete Striche
    // liegen in localStorage und werden nach dem Remount neu gezeichnet – kein Datenverlust.
    const bump = () => {
      if (document.visibilityState === 'hidden') return;
      setRemountEpoch((n) => n + 1);
    };
    const onVisible = () => {
      onResize();
      bump();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    // Ausrichtung auch bei focus neu prüfen (billig), aber den Remount NUR bei echtem
    // Sichtbarkeitswechsel auslösen – `focus` feuert am Desktop bei jedem Tab-Wechsel.
    window.addEventListener('focus', onResize);
    window.addEventListener('pageshow', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.removeEventListener('focus', onResize);
      window.removeEventListener('pageshow', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Sichtbare Seiten malen + Striche laden + Seitenverhältnis setzen
  useEffect(() => {
    if (loading) return;
    const nextAspects = [...aspects];
    for (let j = 0; j < perView; j++) {
      const content = contentRefs[j].current;
      const anno = annoRefs[j].current;
      if (!content || !anno) continue;
      const src = pages[pageIndex + j];
      if (!src) continue;
      content.width = src.width;
      content.height = src.height;
      content.getContext('2d')!.drawImage(src, 0, 0);
      anno.width = src.width;
      anno.height = src.height;
      const ctx = anno.getContext('2d')!;
      ctx.clearRect(0, 0, anno.width, anno.height);
      // Eigene Striche, wenn diese Seite keine fremde Ebene zeigt – ODER in der
      // Zusammenführen-Vorschau (dann beide Ebenen übereinander).
      const key = viewing(pageIndex + j) && !previewOwn ? null : drawKeyFor(pageIndex + j);
      const saved = key ? localStorage.getItem(key) : null;
      if (saved) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = saved;
      }
      // Overlay-Striche (anderer Bereich, nur lesend) auf die Overlay-Canvas.
      const over = overlayRefs[j].current;
      if (over) {
        over.width = src.width;
        over.height = src.height;
        const octx = over.getContext('2d')!;
        octx.clearRect(0, 0, over.width, over.height);
        const oKey = overlayKeyFor(pageIndex + j);
        const oSaved = oKey ? localStorage.getItem(oKey) : null;
        if (oSaved) {
          const img = new Image();
          img.onload = () => octx.drawImage(img, 0, 0);
          img.src = oSaved;
        }
      }
      nextAspects[j] = `${src.width} / ${src.height}`;
    }
    setAspects(nextAspects);
    // Gespeicherten Zoom NACH dem Neuzeichnen erneut anwenden: das Setzen der Canvas-Maße löst in
    // der Zoom-Bibliothek eine Neuvermessung aus (ResizeObserver → Neuausrichtung Richtung Mitte),
    // die den in onInit gesetzten Zoom überschreiben kann. Doppel-rAF liegt sicher NACH dieser
    // Neuausrichtung; das 250-ms-Netz fängt Nachzügler (z. B. Ausricht-Animationen). Ohne das
    // sprang die Seite nach dem Blättern zurück in die Mitte, bis der nächste Sync sie rettete.
    const applySaved = () => restoreVisibleZoom({ fitUnsaved: true });
    requestAnimationFrame(() => requestAnimationFrame(applySaved));
    const net = window.setTimeout(applySaved, 250);
    return () => window.clearTimeout(net);
    // remountEpoch: nach dem erzwungenen Remount (App-Rückkehr) sind die Canvas-Elemente neu →
    // hier neu zeichnen, sonst blieben sie leer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pages, pageIndex, perView, syncTick, viewKeyFor, remountEpoch, previewOwn]);

  // Strich-Bilder der Nachbarseiten vorab dekodieren → der Slide-Streifen kann sie beim
  // Blättern SOFORT (synchron) mitzeichnen, ohne auf Image-Decode zu warten.
  useEffect(() => {
    if (loading) return;
    for (let p = Math.max(0, pageIndex - 2); p <= Math.min(pageCount - 1, pageIndex + 3); p++) {
      // Beide Ebenen (interaktiv + Overlay) vorhalten, damit der Streifen vollständig aussieht.
      for (const key of [viewing(p) && !previewOwn ? null : drawKeyFor(p), overlayKeyFor(p)]) {
        if (!key) continue;
        const data = localStorage.getItem(key);
        if (!data) {
          strokeImgCache.current.delete(key);
          continue;
        }
        const cached = strokeImgCache.current.get(key);
        if (cached && cached.src === data) continue;
        const img = new Image();
        img.src = data;
        strokeImgCache.current.set(key, img);
      }
    }
    // Cache klein halten (älteste Einträge zuerst raus – Map behält die Einfüge-Reihenfolge).
    while (strokeImgCache.current.size > 40) {
      const oldest = strokeImgCache.current.keys().next().value;
      if (oldest === undefined) break;
      strokeImgCache.current.delete(oldest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, pageCount, syncTick, loading, viewKeyFor, previewOwn]);

  // Eine Streifen-Hälfte (1–2 Seiten ab `start`) aus offscreen-Seite + Strichen zusammensetzen.
  function composePane(start: number): SlideSlot[] {
    const out: SlideSlot[] = [];
    for (let j = 0; j < perView; j++) {
      const p = start + j;
      const src = pages[p];
      if (!src) break;
      const c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(src, 0, 0);
      // Beide Ebenen in den Streifen zeichnen (Overlay zuerst, interaktive Ebene obenauf) –
      // im Slide sieht die Seite damit exakt aus wie in der Live-Ansicht.
      const texts: PageTextObj[] = [];
      for (const key of [overlayKeyFor(p), viewing(p) && !previewOwn ? null : drawKeyFor(p)]) {
        if (!key) continue;
        const strokes = strokeImgCache.current.get(key);
        if (strokes && strokes.complete && strokes.naturalWidth > 0) ctx.drawImage(strokes, 0, 0);
        try {
          const t = localStorage.getItem(`${key}_text`);
          if (t) texts.push(...(JSON.parse(t) as PageTextObj[]));
        } catch {
          /* ignorieren */
        }
      }
      out.push({ canvas: c, texts, zoom: loadZoom(p), aspect: `${src.width} / ${src.height}` });
    }
    return out;
  }

  // Slide-Übergang beim Blättern (Auslösen ±1 + Abspielen) – ausgelagert in useSlideTransition.
  // composePane bleibt hier, weil es tief in die Zeichen-/Overlay-Interna greift.
  const { slide, slidePanes, slideOverlayRef } = useSlideTransition({
    pageIndex,
    perView,
    pages,
    loading,
    composePane,
  });

  // Text-Ebene exakt auf die dargestellte Seiten-Canvas legen (ein leeres div mit nur aspect-ratio
  // kollabiert im Grid auf 0×0 → Text ließe sich nicht platzieren). Per ResizeObserver mitführen.
  useEffect(() => {
    function sync() {
      for (let j = 0; j < perView; j++) {
        const a = annoRefs[j].current;
        const l = layerRefs[j].current;
        if (a && l) {
          l.style.width = `${a.clientWidth}px`;
          l.style.height = `${a.clientHeight}px`;
        }
      }
    }
    sync();
    const ro = new ResizeObserver(sync);
    for (let j = 0; j < perView; j++) {
      const a = annoRefs[j].current;
      if (a) ro.observe(a);
    }
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perView, loading, pages, pageIndex]);

  // Aktive Seite im sichtbaren Fenster halten
  useEffect(() => {
    const maxVisible = pageIndex + perView - 1;
    if (activePage < pageIndex || activePage > maxVisible) onActivePage(pageIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perView, pageIndex, activePage]);

  // Sicherheit gegen hängengebliebene Striche: beim Verlassen des Zeichenmodus/Seitenwechsel
  // den Zeichen-Zustand zurücksetzen.
  useEffect(() => {
    stroke.current = false;
    strokePointer.current = -1;
    strokeCanvas.current = null;
    lastPt.current = null;
  }, [drawMode, pageIndex, perView]);

  // Beim Blättern/Drehen den Gesten-Zustand zurücksetzen. Das eigentliche Wiederherstellen des
  // gespeicherten Zooms passiert VERZÖGERUNGSFREI in onInit jeder Zoom-Ebene (die per Seiten-key
  // beim Blättern neu aufgebaut wird) – onInit feuert genau dann, wenn die Ebene vermessen ist.
  // Dieser Effekt ist nur noch Absicherung (falls kein Remount stattfand).
  useEffect(() => {
    if (gestureEndTimer.current) clearTimeout(gestureEndTimer.current);
    gestureSlot.current = null;
    lastScale.current = [1, 1]; // Merker der Vorseite verwerfen (sonst löscht ein Mini-Pinch fälschlich)
    if (loading) return;
    requestAnimationFrame(() => restoreVisibleZoom({ fitUnsaved: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, perView, loading]);

  // Gesten-Ende-Timer beim Unmount aufräumen.
  useEffect(
    () => () => {
      if (gestureEndTimer.current) clearTimeout(gestureEndTimer.current);
    },
    [],
  );

  // Nach einem HINTERGRUND-Neuaufbau der Seiten (neues pages-Array, z. B. Transponieren/Spalten/
  // Version oder 30-Sekunden-Sync) den gespeicherten Zoom je sichtbarer Seite ERNEUT anwenden.
  // Sonst geht ein per Pinch gesetzter Zoom beim Neu-Zeichnen der Canvas verloren, obwohl er im
  // Speicher steht. Setzt NIE auf Fit zurück und lässt einen gerade aktiven Slot unangetastet (#33).
  const pagesSeen = useRef(pages);
  useEffect(() => {
    if (pages === pagesSeen.current) return;
    pagesSeen.current = pages;
    if (loading) return;
    // Hintergrund-Neuaufbau desselben Layouts → NIE auf Fit zurücksetzen (fitUnsaved:false).
    requestAnimationFrame(() => restoreVisibleZoom({ fitUnsaved: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  // Nach App-Rückkehr / Anmerkungs-Sync / Editor-Schließen (syncTick) die sichtbaren Seiten neu
  // AUSRICHTEN: gespeicherter Zoom → anwenden; kein gespeicherter, aber hängengebliebener Zoom →
  // auf Fit. So löst sich auch eine „steckende" Seite nach Editor-Rückkehr. Ein gerade aktiv
  // gezoomter Slot bleibt unberührt (kein laufender Pinch abbrechen, #33).
  const syncSeen = useRef(syncTick);
  useEffect(() => {
    if (syncTick === syncSeen.current) return;
    syncSeen.current = syncTick;
    requestAnimationFrame(() => restoreVisibleZoom({ fitUnsaved: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncTick]);

  // ── Striche zeichnen (auf der Anno-Canvas der jeweiligen Seite) ──
  function ptOf(e: React.PointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
  // Laufenden Strich verwerfen (zweiter Finger = Zoom/Verschieben, kein Zeichnen): Canvas auf den
  // Schnappschshot vor dem Strich zurücksetzen und den Verlaufseintrag entfernen.
  function cancelStroke() {
    if (!stroke.current) return;
    const canvas = strokeCanvas.current;
    const snap = strokeSnapshot.current;
    if (canvas && snap) {
      const ctx = canvas.getContext('2d')!;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(snap, 0, 0);
    }
    try {
      canvas?.releasePointerCapture(strokePointer.current);
    } catch {
      /* ignorieren */
    }
    draws[strokeSlot.current].dropHistory();
    stroke.current = false;
    strokePointer.current = -1;
    strokePointerType.current = '';
    lastPt.current = null;
    markerBase.current = null;
    markerPts.current = [];
    strokeCanvas.current = null;
    strokeSnapshot.current = null;
  }
  function strokeDown(e: React.PointerEvent, slot: number) {
    if (!drawMode || drawTool === 'text') return;
    // Zweiter Zeiger während eines laufenden Strichs:
    if (stroke.current && e.pointerId !== strokePointer.current) {
      // Stift zeichnet + Finger dazu → Handballen ignorieren (Strich läuft weiter).
      if (strokePointerType.current === 'pen' && e.pointerType === 'touch') return;
      // Finger zeichnete + zweiter Zeiger dazu → das war eine Zoom-/Verschiebe-Geste: verwerfen.
      cancelStroke();
      return;
    }
    // Nur der primäre Finger startet einen Strich (zweiter Finger beim Multitouch ignorieren) →
    // so bleibt die Zwei-Finger-Geste dem Zoom/Verschieben vorbehalten, auch im Zeichenmodus.
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    // #53: Auf der inaktiven Seite wird NICHT gezeichnet – der Tipp aktiviert sie nur.
    if (perView === 2 && slot !== activeSlot) {
      e.stopPropagation();
      onActivePage(pageIndex + slot);
      return;
    }
    const canvas = annoRefs[slot].current;
    if (!canvas) return;
    e.stopPropagation();
    // Pointer einfangen → Move/Up kommen GARANTIERT an, auch wenn der Finger die Fläche verlässt
    // (verhindert hängengebliebene, nicht beendete Striche).
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignorieren */
    }
    // Schnappschuss vor dem Strich (für Marker-Glättung UND zum Verwerfen bei Zwei-Finger-Geste).
    const snap = document.createElement('canvas');
    snap.width = canvas.width;
    snap.height = canvas.height;
    snap.getContext('2d')!.drawImage(canvas, 0, 0);
    strokeSnapshot.current = snap;
    draws[slot].setSelectedId(null);
    draws[slot].pushHistory();
    stroke.current = true;
    strokePointer.current = e.pointerId;
    strokePointerType.current = e.pointerType;
    strokeCanvas.current = canvas;
    strokeSlot.current = slot;
    lastPt.current = ptOf(e, canvas);
    if (drawTool === 'marker') {
      markerBase.current = snap; // gleicher Schnappschuss = Basis für den Leuchtmarker-Strich
      markerPts.current = [lastPt.current];
    }
  }
  function strokeMove(e: React.PointerEvent) {
    if (!stroke.current || strokePointer.current !== e.pointerId || !strokeCanvas.current) return;
    const canvas = strokeCanvas.current;
    const ctx = canvas.getContext('2d')!;
    const p = ptOf(e, canvas);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (drawTool === 'marker' && markerBase.current) {
      // Den ganzen bisherigen Marker-Strich als EINE halbtransparente Linie neu zeichnen
      // (auf dem Schnappschuss) → gleichmäßiger Leuchtmarker statt Punktreihe.
      markerPts.current.push(p);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(markerBase.current, 0, 0);
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = toolSizes.marker;
      ctx.strokeStyle = drawColor;
      const pts = markerPts.current;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      lastPt.current = p;
      return;
    }
    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.lineWidth = toolSizes.eraser;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.lineWidth = toolSizes.pen;
      ctx.strokeStyle = drawColor;
    }
    ctx.beginPath();
    ctx.moveTo(lastPt.current!.x, lastPt.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    lastPt.current = p;
  }
  function strokeUp(e?: React.PointerEvent) {
    if (!stroke.current) return;
    if (e && strokePointer.current !== e.pointerId) return;
    stroke.current = false;
    strokePointer.current = -1;
    strokePointerType.current = '';
    lastPt.current = null;
    markerBase.current = null;
    markerPts.current = [];
    strokeSnapshot.current = null;
    draws[strokeSlot.current].saveStrokes();
    strokeCanvas.current = null;
  }

  // Offene Inline-Eingabe eines Slots übernehmen (leerer Text = verwerfen). Lock verhindert
  // Doppel-Commit, wenn Blur UND Außen-Tipp im selben Moment feuern.
  function commitInlineText(slot: number) {
    const d = draws[slot];
    if (!d.pending || textCommitLock.current[slot]) return;
    textCommitLock.current[slot] = true;
    const el = editRefs.current[slot];
    // innerText (nicht textContent) → erhält Zeilenumbrüche als \n; nur Ränder trimmen,
    // interne Umbrüche/Abstände bleiben erhalten.
    const value = (el?.innerText ?? '')
      .replace(/\u00A0/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
    d.confirmText(value, drawColor, textSize, textStyle);
  }
  // Lock wieder freigeben, sobald die jeweilige Eingabe geschlossen/geöffnet wurde.
  useEffect(() => {
    textCommitLock.current[0] = false;
  }, [drawA.pending]);
  useEffect(() => {
    textCommitLock.current[1] = false;
  }, [drawB.pending]);

  // Beim Text-Bearbeiten die iOS-Tastatur „vermeiden" (nur den Chart-Bereich anheben) – ausgelagert
  // in useKeyboardInsets. preLiftForEditor wird synchron in der Tipp-Geste (focusEditor) genutzt.
  const anyPending = !!(drawA.pending || drawB.pending);
  const { preLiftForEditor } = useKeyboardInsets({
    rootRef,
    editRefs,
    anyPending,
    pendingSlot: drawA.pending ? 0 : 1,
  });

  // Inline-Eingabe fokussieren + Cursor ans Ende. MUSS synchron in der Tipp-Geste passieren,
  // damit iOS die Tastatur öffnet (asynchroner Fokus per setTimeout wird von iOS ignoriert).
  function focusEditor(slot: number) {
    const el = editRefs.current[slot];
    if (!el) return;
    // VOR dem Fokus den Chart-Bereich anheben (gelernte Tastaturhöhe) – Details im Hook.
    preLiftForEditor(slot);
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  // Text platzieren (Tipp mit Text-Werkzeug auf leere Stelle der Seite) → blinkender Cursor
  // direkt an der Stelle (Inline-Eingabe wie in Word/GoodNotes).
  function layerDown(e: React.PointerEvent, slot: number) {
    if (!drawMode || drawTool !== 'text') return;
    // #53: Text nur auf der aktiven Seite – Tipp auf die inaktive Seite aktiviert sie nur.
    if (perView === 2 && slot !== activeSlot) {
      e.stopPropagation();
      onActivePage(pageIndex + slot);
      return;
    }
    const layer = layerRefs[slot].current;
    if (!layer) return;
    e.stopPropagation();
    const d = draws[slot];
    // Offene Inline-Eingabe? → Tipp daneben übernimmt den Text (steht dann fest), kein neues Feld.
    if (d.pending) {
      commitInlineText(slot);
      return;
    }
    // Ist ein Text ausgewählt? → Tipp ins Leere hebt die Auswahl auf (Rahmen weg), kein neues Feld.
    if (d.selectedId !== null) {
      d.setSelectedId(null);
      return;
    }
    const rect = layer.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    // flushSync → die Inline-Eingabe wird SOFORT (synchron) eingehängt, danach fokussieren wir
    // noch innerhalb der Tipp-Geste → iOS öffnet die Tastatur.
    flushSync(() => d.placeText(fx, fy, e.clientX, e.clientY));
    focusEditor(slot);
  }

  // Zieh-Knopf am Auswahlrahmen: Größe des ausgewählten Textes per Ziehen ändern.
  function handleResizeDown(e: React.PointerEvent, slot: number, id: number, size: number) {
    e.stopPropagation();
    const layer = layerRefs[slot].current;
    if (!layer) return;
    draws[slot].pushHistory();
    resizeDrag.current = {
      slot,
      id,
      startY: e.clientY,
      startSize: size,
      layerH: layer.clientHeight,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handleResizeMove(e: React.PointerEvent) {
    const r = resizeDrag.current;
    if (!r || r.layerH <= 0) return;
    e.stopPropagation();
    // Ziehen nach unten = größer: Y-Weg in % der Seitenhöhe direkt auf die cqh-Größe addieren.
    const next = r.startSize + ((e.clientY - r.startY) / r.layerH) * 100;
    draws[r.slot].setSize(r.id, next);
  }
  function handleResizeUp(e: React.PointerEvent) {
    if (!resizeDrag.current) return;
    e.stopPropagation();
    resizeDrag.current = null;
  }

  // ── Blättern / aktive Hälfte ──
  // Max. linke Seite: im 2-up so, dass NIE eine Seite allein rechts steht (immer 2 sichtbar);
  // nur bei genau 1 Seite gesamt bleibt eine einzelne (linksbündige) Seite.
  const maxLeft = perView === 2 && pageCount > 1 ? pageCount - 2 : Math.max(0, pageCount - 1);
  function go(delta: number) {
    const target = pageIndex + delta;
    if (target < 0) {
      onBeforeFirst?.(); // über die erste Seite hinaus (z. B. voriges Lied)
      return;
    }
    if (target > maxLeft) {
      onAfterLast?.(); // über die letzte Seite hinaus (z. B. nächstes Lied)
      return;
    }
    if (target !== pageIndex) {
      onPageIndex(target);
      onActivePage(target);
    }
  }
  function onTouchStart(e: React.TouchEvent) {
    // Ein Finger = blättern (hier). Zwei+ Finger gehören der Zoom-Bibliothek (Zoom + Verschieben).
    if (drawMode || e.touches.length > 1) {
      touchStart.current = null;
      return;
    }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (drawMode || !touchStart.current) return;
    const dx = touchStart.current.x - e.changedTouches[0].clientX;
    const dy = touchStart.current.y - e.changedTouches[0].clientY;
    const startX = touchStart.current.x;
    touchStart.current = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx > 0 ? 1 : -1);
    else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) tapAt(startX, e.currentTarget as HTMLElement);
    // den von iOS nachgereichten Klick unterdrücken (sonst doppelte Navigation = Seite übersprungen)
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 500);
  }
  function tapAt(clientX: number, root: HTMLElement) {
    const r = root.getBoundingClientRect();
    const fx = (clientX - r.left) / r.width;
    if (fx < 0.18) {
      go(-1); // linker Rand → zurück
      return;
    }
    if (fx > 0.82) {
      go(1); // rechter Rand → weiter
      return;
    }
    if (perView < 2) return;
    const slot = fx < 0.5 ? 0 : 1; // Mitte: angetippte Hälfte wird aktiv
    const target = pageIndex + slot;
    if (target < pageCount) onActivePage(target);
  }
  function onClick(e: React.MouseEvent) {
    if (drawMode) return;
    if (suppressClick.current) {
      suppressClick.current = false; // war ein Touch-Tap (schon behandelt) → Klick ignorieren
      return;
    }
    tapAt(e.clientX, e.currentTarget as HTMLElement);
  }

  // „Ist reingezoomt?" nach oben melden – steuert den Reset-Knopf in der Kopfleiste (ChordChart).
  const anyZoomed = zoomedSlots.slice(0, perView).some(Boolean);
  useEffect(() => {
    onZoomedChange?.(anyZoomed);
  }, [anyZoomed, onZoomedChange]);

  // Reset-Knopf der Kopfleiste gedrückt (Signal erhöht) → sichtbaren Zoom zurücksetzen.
  const lastResetSignal = useRef(resetZoomSignal);
  useEffect(() => {
    if (resetZoomSignal === lastResetSignal.current) return;
    lastResetSignal.current = resetZoomSignal;
    resetVisibleZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetZoomSignal]);

  const slots: number[] = [];
  for (let j = 0; j < perView; j++) {
    if (pageIndex + j >= pageCount) break;
    slots.push(j);
  }

  const selectedText = activeDraw.texts.find((o) => o.id === activeDraw.selectedId) ?? null;
  // #53: im 2-up Zeichenmodus wird die inaktive Seite ausgegraut/zurückgestellt (und ist gesperrt –
  // das erledigen strokeDown/layerDown). Die aktive Seite bleibt in voller Deckkraft = hervorgehoben.
  function slotClass(j: number): string {
    if (!drawMode || perView !== 2 || slots.length < 2 || j === activeSlot) return styles.slot;
    return `${styles.slot} ${styles.slotInactive}`;
  }

  const label =
    !loading && !error && pageCount > 0 && !drawMode && pageLabel
      ? pageLabel(activePage, pageIndex, pageCount)
      : null;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
    >
      {loading && (
        <div className={styles.center}>
          <Spinner />
          <span>{loadingLabel}</span>
        </div>
      )}
      {error && <div className={styles.center}>⚠️ {error}</div>}
      {!loading && slots.length === 2 && <div className={styles.divider} />}

      <div className={styles.row} style={{ visibility: loading ? 'hidden' : 'visible' }}>
        {slots.map((j) => {
          const d = draws[j];
          return (
            <div key={j} className={slotClass(j)}>
              {/* key = SEITE + LAYOUT (perView): beim Blättern UND beim Formatwechsel (Hoch↔Quer)
                  wird die Zoom-Ebene frisch aufgebaut statt den Transform-Zustand des vorherigen
                  Zustands dieser Hälfte zu erben (sonst blieb die linke Hälfte beim Drehen im Zoom
                  „stecken"). onInit stellt danach den für DIESES Layout gespeicherten Zoom her (bzw.
                  passt ein, wenn keiner gespeichert ist). Beim Hintergrund-Neuaufbau (pages-Tausch)
                  bleibt der key gleich → kein Remount, laufende Gesten unberührt. */}
              <TransformWrapper
                key={`p${pageIndex + j}_v${perView}_e${remountEpoch}`}
                ref={transformRefs[j]}
                minScale={MIN_SCALE}
                maxScale={MAX_SCALE}
                centerOnInit
                centerZoomedOut
                initialScale={1}
                limitToBounds
                doubleClick={{ disabled: true }}
                // Gespeicherten Zoom SOFORT anwenden, sobald die Ebene vermessen ist (kein Warten
                // auf einen späteren Effekt → keine sichtbare Verzögerung nach dem Blättern).
                onInit={(ref) => {
                  if (gestureSlot.current === j) return;
                  const saved = loadZoom(pageIndex + j);
                  if (saved) ref.setTransform(saved.x, saved.y, saved.scale, 0);
                }}
                // Ein-Finger-Panning IMMER aus: ein Finger blättert (bzw. zeichnet im Zeichenmodus).
                // Zwei Finger gehören der Zoom-Geste – die zoomt UND verschiebt (Mittelpunkt-Bewegung),
                // AUCH im Zeichenmodus: so kann man beim Anmerken kurz zoomen/verschieben, ohne den
                // Modus zu verlassen (ein begonnener Strich wird bei Zweitfinger verworfen).
                panning={{ disabled: true }}
                pinch={{ disabled: false }}
                wheel={{ disabled: false, step: 0.08 }}
                // gestureSlot synchron am Gesten-Start setzen (Pinch löst onZoomStart aus, auch beim
                // reinen Zwei-Finger-Verschieben) → schon das erste onTransformed sichert korrekt und
                // programmatisches Wiederherstellen schreibt nicht zurück.
                onZoomStart={() => {
                  if (gestureEndTimer.current) clearTimeout(gestureEndTimer.current);
                  gestureSlot.current = j;
                }}
                // Gesten-Ende: gestureSlot leicht verzögert freigeben – die Ausricht-Animation der
                // Bibliothek läuft nach dem Loslassen noch ~200 ms und soll den ENDWERT speichern.
                // Danach können programmatische Transformen weder speichern noch löschen, und die
                // Wiederherstell-Effekte dürfen diesen Slot wieder bedienen.
                onZoomStop={() => {
                  if (gestureEndTimer.current) clearTimeout(gestureEndTimer.current);
                  gestureEndTimer.current = setTimeout(() => {
                    gestureSlot.current = null;
                  }, 350);
                }}
                onTransformed={(_ref, state) => {
                  persistZoom(j);
                  const z = state.scale > 1.01;
                  setZoomedSlots((prev) => {
                    if (prev[j] === z) return prev;
                    const next: [boolean, boolean] = [prev[0], prev[1]];
                    next[j] = z;
                    return next;
                  });
                }}
              >
                <TransformComponent
                  wrapperStyle={{ width: '100%', height: '100%' }}
                  contentStyle={{ width: '100%', height: '100%' }}
                >
                  <div
                    className={styles.pageBox}
                    // Im 2-up (2 Seiten sichtbar) sitzt jede Seite mittig in IHRER Hälfte. Eine
                    // allein stehende LETZTE Seite eines mehrseitigen Charts bleibt LINKS wie ein
                    // normales linkes Blatt (springt so beim Blättern nicht in die Mitte). Ein
                    // Chart mit NUR EINER Seite (pageCount === 1) wird dagegen über die volle Breite
                    // zentriert – sonst klebte es unmotiviert links neben einer leeren Hälfte.
                    style={{
                      justifyItems:
                        perView === 2 && slots.length === 1 && pageCount > 1 ? 'start' : 'center',
                    }}
                  >
                    <canvas ref={contentRefs[j]} className={styles.contentCanvas} />
                    {/* Striche der gerade ANGESEHENEN fremden Ebene ([]=Notizen von X, nur lesend). */}
                    <canvas
                      ref={overlayRefs[j]}
                      className={styles.annoCanvas}
                      style={{ pointerEvents: 'none' }}
                    />
                    <canvas
                      ref={annoRefs[j]}
                      className={styles.annoCanvas}
                      style={{
                        pointerEvents: drawMode && drawTool !== 'text' ? 'all' : 'none',
                        cursor: drawMode ? 'crosshair' : 'default',
                      }}
                      onPointerDown={(e) => strokeDown(e, j)}
                      onPointerMove={strokeMove}
                      onPointerUp={strokeUp}
                      onPointerCancel={strokeUp}
                    />
                    <div
                      ref={layerRefs[j]}
                      className={styles.textLayer}
                      style={{
                        aspectRatio: aspects[j],
                        pointerEvents: drawMode && drawTool === 'text' ? 'all' : 'none',
                      }}
                      onPointerDown={(e) => layerDown(e, j)}
                    >
                      {/* Texte der gerade angesehenen fremden Ebene (nur lesend). */}
                      {overlayTexts[j].map((o) => (
                        <div
                          key={`ov-${o.id}`}
                          className={styles.textObj}
                          style={{
                            left: `${o.fx * 100}%`,
                            top: `${o.fy * 100}%`,
                            fontSize: `${o.sizeCqh}cqh`,
                            color: o.color,
                            fontWeight: (o.bold ?? true) ? 700 : 400,
                            fontStyle: o.italic ? 'italic' : 'normal',
                            textDecoration: o.underline ? 'underline' : 'none',
                            textAlign: o.align ?? 'center',
                            pointerEvents: 'none',
                          }}
                        >
                          {o.text}
                        </div>
                      ))}
                      {(!viewing(pageIndex + j) || previewOwn) &&
                        d.texts
                          // Gerade bearbeiteter Text wird durch die Inline-Eingabe ersetzt.
                          .filter((o) => o.id !== d.pending?.editId)
                          .map((o) => (
                            <div
                              key={o.id}
                              className={`${styles.textObj}${o.id === d.selectedId ? ' ' + styles.textSel : ''}`}
                              style={{
                                left: `${o.fx * 100}%`,
                                top: `${o.fy * 100}%`,
                                fontSize: `${o.sizeCqh}cqh`,
                                color: o.color,
                                // Format je Block. Bestandstexte (ohne bold-Feld) waren immer fett →
                                // Fallback true, damit sie unverändert aussehen; neue Texte sind normal.
                                fontWeight: (o.bold ?? true) ? 700 : 400,
                                fontStyle: o.italic ? 'italic' : 'normal',
                                textDecoration: o.underline ? 'underline' : 'none',
                                textAlign: o.align ?? 'center',
                                // Text nur im Text-Werkzeug interaktiv → mit Stift/Marker kann man
                                // ungehindert DARÜBER zeichnen (sonst „fängt" der Text die Eingabe ab).
                                // Und NUR auf der aktiven Hälfte (#53): auf der ausgegrauten Seite ist
                                // der Text durchlässig – der Tipp fällt auf die Ebene durch und
                                // aktiviert die Seite (layerDown), statt den Text zu wählen/bearbeiten.
                                pointerEvents:
                                  drawMode &&
                                  drawTool === 'text' &&
                                  !(perView === 2 && j !== activeSlot)
                                    ? 'all'
                                    : 'none',
                                cursor: 'grab',
                              }}
                              onPointerDown={(e) => d.startDrag(e, o)}
                              onPointerMove={(e) => d.moveDrag(e, o.id)}
                              onPointerUp={() => {
                                // endDrag entscheidet: Tipp auf ausgewählten Text → bearbeiten. flushSync
                                // hängt die Eingabe sofort ein, danach synchron fokussieren → iOS-Tastatur.
                                flushSync(() => d.endDrag());
                                focusEditor(j);
                              }}
                              onPointerCancel={d.endDrag}
                            >
                              {o.text}
                              {/* Zieh-Knopf (Ecke unten rechts) am ausgewählten Text: Größe ändern. */}
                              {o.id === d.selectedId && drawMode && drawTool === 'text' && (
                                <span
                                  className={styles.textHandle}
                                  onPointerDown={(e) => handleResizeDown(e, j, o.id, o.sizeCqh)}
                                  onPointerMove={handleResizeMove}
                                  onPointerUp={handleResizeUp}
                                  onPointerCancel={handleResizeUp}
                                  aria-label="Textgröße ändern"
                                />
                              )}
                            </div>
                          ))}
                      {/* Inline-Eingabe: blinkender Cursor direkt an der Tipp-Stelle. */}
                      {d.pending &&
                        (() => {
                          const p = d.pending;
                          const editing =
                            p.editId != null ? d.texts.find((t) => t.id === p.editId) : null;
                          // Beim Bearbeiten den Stil des Textes, sonst den aktuellen Pinsel-Stil.
                          const st: TextStyle = editing
                            ? {
                                bold: editing.bold ?? true,
                                italic: !!editing.italic,
                                underline: !!editing.underline,
                                align: editing.align ?? 'center',
                              }
                            : textStyle;
                          return (
                            <span
                              key={`edit-${d.pending.editId ?? 'new'}`}
                              ref={(n) => {
                                editRefs.current[j] = n;
                                // Nur den Startinhalt setzen; der Fokus passiert synchron in der
                                // Tipp-Geste (focusEditor nach flushSync) → nötig für die iOS-Tastatur.
                                if (n && !n.dataset.init) {
                                  n.dataset.init = '1';
                                  n.textContent = p.initial ?? '';
                                }
                              }}
                              contentEditable
                              suppressContentEditableWarning
                              className={`${styles.textObj} ${styles.textEditing}`}
                              style={{
                                left: `${(editing?.fx ?? p.fx) * 100}%`,
                                top: `${(editing?.fy ?? p.fy) * 100}%`,
                                fontSize: `${editing?.sizeCqh ?? textSize}cqh`,
                                color: editing?.color ?? drawColor,
                                fontWeight: st.bold ? 700 : 400,
                                fontStyle: st.italic ? 'italic' : 'normal',
                                textDecoration: st.underline ? 'underline' : 'none',
                                textAlign: st.align,
                                pointerEvents: 'all',
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              onBlur={() => commitInlineText(j)}
                              onKeyDown={(e) => {
                                // Enter = Zeilenumbruch (Standard-Verhalten); Fertigstellen durch
                                // Tippen daneben. Escape bricht ab.
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  d.cancelText();
                                }
                              }}
                            />
                          );
                        })()}
                    </div>
                  </div>
                </TransformComponent>
              </TransformWrapper>
            </div>
          );
        })}
      </div>

      {/* Slide-Übergang: deckt die Live-Ansicht während des Blätterns ab und schiebt alte und
          neue Seiten horizontal (wie im Foto-Viewer). Nicht interaktiv (pointer-events: none). */}
      {slide && slidePanes.current && (
        <div ref={slideOverlayRef} className={styles.slideOverlay} aria-hidden="true">
          {[
            { pk: 'old', pane: slidePanes.current.old },
            { pk: 'neu', pane: slidePanes.current.neu },
          ].map(({ pk, pane }) => (
            // key mit tick: Startet ein neuer Übergang, WÄHREND der alte noch läuft (schnelles
            // Tastatur-Blättern), werden die Ebenen frisch aufgebaut statt wiederverwendet.
            // Sonst bliebe die alte Seiten-Grafik im DOM liegen (der Einfüge-Ref entfernt sie
            // nicht) und deckte als späteres Geschwister die neue ab → altes Lied blitzte auf.
            <div key={`${pk}${slide.tick}`} data-pane={pk} className={styles.slidePane}>
              {pane.length === 2 && <div className={styles.divider} />}
              <div className={styles.row}>
                {pane.map((s, j) => (
                  <div key={j} className={styles.slot}>
                    <div
                      className={styles.slideContent}
                      style={
                        s.zoom
                          ? {
                              transform: `translate3d(${s.zoom.x}px, ${s.zoom.y}px, 0) scale(${s.zoom.scale})`,
                              transformOrigin: '0 0',
                            }
                          : undefined
                      }
                    >
                      <div
                        className={styles.pageBox}
                        style={{
                          justifyItems: perView === 2 && pane.length === 1 ? 'start' : 'center',
                        }}
                        ref={(n) => {
                          if (n && s.canvas.parentElement !== n) {
                            s.canvas.className = styles.contentCanvas;
                            n.insertBefore(s.canvas, n.firstChild);
                          }
                        }}
                      >
                        <div
                          data-slide-textlayer
                          className={styles.textLayer}
                          style={{ aspectRatio: s.aspect }}
                        >
                          {s.texts.map((o) => (
                            <div
                              key={o.id}
                              className={styles.textObj}
                              style={{
                                left: `${o.fx * 100}%`,
                                top: `${o.fy * 100}%`,
                                fontSize: `${o.sizeCqh}cqh`,
                                color: o.color,
                                // Exakt wie in der Live-Ansicht formatieren, sonst springt der Text
                                // beim Übergang Slide→Live (CSS-Default 700 vs. echtes Gewicht) und
                                // blinkt (#113, v. a. normaler Text = 400).
                                fontWeight: (o.bold ?? true) ? 700 : 400,
                                fontStyle: o.italic ? 'italic' : 'normal',
                                textDecoration: o.underline ? 'underline' : 'none',
                                textAlign: o.align ?? 'center',
                              }}
                            >
                              {o.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Werkzeugleiste (volle Anmerkungen für die aktive Seite) */}
      {drawMode && (
        <DrawToolbar
          colors={drawColors}
          drawColor={drawColor}
          setDrawColor={setDrawColor}
          drawTool={drawTool}
          setDrawTool={(t) => {
            // Werkzeugwechsel (z. B. auf den Stift) beendet eine offene Textbearbeitung und
            // hebt die Auswahl auf – auf allen Seiten, damit keine UI hängen bleibt (#39).
            for (const d of draws) {
              d.cancelText();
              d.setSelectedId(null);
            }
            setDrawTool(t);
          }}
          toolSizes={toolSizes}
          onToolSize={(tool, size) => setToolSizes((s) => ({ ...s, [tool]: size }))}
          textSize={textSize}
          setTextSize={setTextSize}
          sizeStep={0.25}
          sizeMin={1}
          sizeMax={10}
          // Anzeige als vertraute „pt"-Zahl (A4-Höhe ≈ 842 pt → pt ≈ cqh × 8,42), gerundet.
          sizeLabel={(v) => `${Math.round(v * 8.42)}`}
          allowText
          onClear={() => setConfirmClear(true)}
          isTextSelected={activeDraw.selectedId !== null}
          selectedColor={selectedText?.color}
          selectedSize={selectedText?.sizeCqh}
          onSelectedColor={(c) =>
            activeDraw.selectedId !== null && activeDraw.setColor(activeDraw.selectedId, c)
          }
          onSelectedResize={(delta) =>
            activeDraw.selectedId !== null && activeDraw.resize(activeDraw.selectedId, delta)
          }
          textStyle={textStyle}
          setTextStyle={setTextStyle}
          selectedStyle={
            selectedText
              ? {
                  bold: selectedText.bold ?? true,
                  italic: !!selectedText.italic,
                  underline: !!selectedText.underline,
                  align: selectedText.align ?? 'center',
                }
              : undefined
          }
          onSelectedStyle={(patch) =>
            activeDraw.selectedId !== null && activeDraw.setStyle(activeDraw.selectedId, patch)
          }
          onUndo={activeDraw.undo}
          canUndo={activeDraw.canUndo}
          onRedo={activeDraw.redo}
          canRedo={activeDraw.canRedo}
          onDeleteSelected={() =>
            activeDraw.selectedId !== null && activeDraw.deleteText(activeDraw.selectedId)
          }
        />
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Markierungen löschen?"
          message="Alle Zeichnungen und Texte auf der aktiven Seite werden entfernt."
          confirmLabel="Löschen"
          onConfirm={() => {
            activeDraw.clearAll();
            setConfirmClear(false);
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {label &&
        (onBadgeClick ? (
          <button
            className={styles.pageBadge}
            onClick={(e) => {
              e.stopPropagation();
              onBadgeClick();
            }}
          >
            {label}
            <span className={styles.pageBadgeArrow}>›</span>
          </button>
        ) : (
          <div className={styles.pageBadge}>{label}</div>
        ))}
    </div>
  );
}
