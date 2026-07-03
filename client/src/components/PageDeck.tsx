import { useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { DrawTool } from '../types/index';
import { usePageDraw, type PageTextObj } from '../hooks/usePageDraw';
import { pushField } from '../services/annotations';
import { deviceClass } from '../utils/deviceClass';
import { DrawToolbar } from './DrawToolbar';
import { ConfirmDialog } from './ConfirmDialog';
import { Spinner } from './Spinner';
import styles from './PageDeck.module.scss';

const MIN_SCALE = 1;
const MAX_SCALE = 6;

/** Eine fertig zusammengesetzte Seite (Inhalt + Striche) für den Slide-Übergangs-Streifen. */
interface SlideSlot {
  canvas: HTMLCanvasElement;
  texts: PageTextObj[];
  zoom: { x: number; y: number; scale: number } | null;
  aspect: string;
}

export interface PageDeckProps {
  /** Fertig gerenderte Seiten (offscreen-Canvas). Der aufrufende Loader liefert sie. */
  pages: HTMLCanvasElement[];
  loading: boolean;
  error: string | null;
  /** Text unter dem Spinner während des Ladens. */
  loadingLabel: string;
  /** localStorage-Schlüssel für Anmerkungen (Striche+Text) einer Seite – oder null (nicht speicherbar). */
  drawKeyFor: (page: number) => string | null;
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

function isLandscape(): boolean {
  // matchMedia('orientation') ist beim Screen-Wechsel/SPA-Navigation stabiler als innerWidth/Height
  // (die kurzzeitig falsch gemeldet werden) → verhindert, dass der Zoom-Schlüssel (perView) kippt
  // und der gespeicherte Zoom beim Wieder-Betreten erst „falsch" erscheint und dann springt.
  if (typeof window.matchMedia === 'function') return window.matchMedia('(orientation: landscape)').matches;
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
  // Inline-Texteingabe direkt auf der Seite (blinkender Cursor statt separater Leiste).
  const editRefs = useRef<(HTMLSpanElement | null)[]>([null, null]);
  const textCommitLock = useRef<[boolean, boolean]>([false, false]); // gegen Doppel-Commit (Blur + Tipp)
  // Zieh-Knopf am Auswahlrahmen: Startgröße + Start-Y + Ebenenhöhe für die Größenänderung.
  const resizeDrag = useRef<{ slot: number; id: number; startY: number; startSize: number; layerH: number } | null>(null);
  const contentRefs = [useRef<HTMLCanvasElement | null>(null), useRef<HTMLCanvasElement | null>(null)];
  const annoRefs = [useRef<HTMLCanvasElement | null>(null), useRef<HTMLCanvasElement | null>(null)];
  const layerRefs = [useRef<HTMLDivElement | null>(null), useRef<HTMLDivElement | null>(null)];
  const transformRefs = [useRef<ReactZoomPanPinchRef | null>(null), useRef<ReactZoomPanPinchRef | null>(null)];
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
  // Welche sichtbaren Seiten gerade reingezoomt sind (auch geladener Zoom) → steuert Panning,
  // Wisch-Navigation und den Zoom-Reset-Knopf. Kein „Anpassen-Modus"/„Fertig" mehr nötig – ein
  // Pinch zoomt und speichert automatisch; Verschieben ist möglich, sobald reingezoomt.
  const [zoomedSlots, setZoomedSlots] = useState<[boolean, boolean]>([false, false]);
  // ── Slide-Übergang beim Blättern (horizontales Schieben wie im Foto-Viewer) ──
  // Der Übergangs-Streifen wird aus den offscreen-Seiten + gespeicherten Anmerkungen/Zooms
  // zusammengesetzt (kein DOM-Abgriff nötig) → funktioniert für ALLE Blätter-Wege (Wischen,
  // Tippen, Fußzeile, Tastatur) und kaschiert das harte Umschalten beim Seitenwechsel.
  const [slide, setSlide] = useState<{ dir: 1 | -1; tick: number } | null>(null);
  const slidePanes = useRef<{ old: SlideSlot[]; neu: SlideSlot[] } | null>(null);
  const slideStripRef = useRef<HTMLDivElement | null>(null);
  const slideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPageIndex = useRef<number | null>(null);
  const slideGuard = useRef<{ perView: number; pages: HTMLCanvasElement[] } | null>(null);
  // Vorab dekodierte Strich-Bilder der Nachbarseiten (localStorage-PNGs) für den Streifen.
  const strokeImgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [aspects, setAspects] = useState<string[]>(['210 / 297', '210 / 297']);
  const [textSize, setTextSize] = useState(1.5); // cqh = % der Seitenhöhe (~13 pt, nahe der Liedtext-Größe)
  const [confirmClear, setConfirmClear] = useState(false);

  const pageCount = pages.length;
  const perView = landscape ? 2 : 1;

  // Zoom hängt an der Bildschirm-Geometrie → Geräteklasse UND Layout (1-spaltig Hochformat /
  // 2-spaltig Querformat) im Schlüssel. Sonst würde ein im Hochformat gespeicherter Pixel-
  // Ausschnitt im Querformat (halbe Breite, 2 Seiten) angewendet und die Seite „einfrieren" (#33).
  const zoomKeyFor = (page: number): string => `${zoomKeyBaseFor(page)}_d${deviceClass()}${perView}`;
  function loadZoom(page: number): { x: number; y: number; scale: number } | null {
    try {
      const s = localStorage.getItem(zoomKeyFor(page));
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed.scale === 'number') return parsed;
      }
    } catch {
      /* ignorieren */
    }
    return null;
  }

  // Ein Anmerkungs-Zustand je sichtbarer Seite (fixe Anzahl Hooks – Regeln der Hooks).
  const drawA = usePageDraw(drawKeyFor(pageIndex), annoRefs[0], layerRefs[0], syncTick);
  const drawB = usePageDraw(drawKeyFor(pageIndex + 1), annoRefs[1], layerRefs[1], syncTick);
  const draws = [drawA, drawB];
  const activeSlot = Math.max(0, Math.min(perView - 1, activePage - pageIndex));
  const activeDraw = draws[activeSlot];

  useEffect(() => {
    const onResize = () => setLandscape(isLandscape());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    // Nach App-Wechsel/Wiederkehr (iOS-PWA) sind die Maße kurz falsch → Ausrichtung neu prüfen.
    window.addEventListener('pageshow', onResize);
    window.addEventListener('focus', onResize);
    document.addEventListener('visibilitychange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.removeEventListener('pageshow', onResize);
      window.removeEventListener('focus', onResize);
      document.removeEventListener('visibilitychange', onResize);
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
      const key = drawKeyFor(pageIndex + j);
      const saved = key ? localStorage.getItem(key) : null;
      if (saved) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = saved;
      }
      nextAspects[j] = `${src.width} / ${src.height}`;
    }
    setAspects(nextAspects);
    // Gespeicherten Zoom NACH dem Neuzeichnen erneut anwenden: das Setzen der Canvas-Maße löst in
    // der Zoom-Bibliothek eine Neuvermessung aus (ResizeObserver → Neuausrichtung Richtung Mitte),
    // die den in onInit gesetzten Zoom überschreiben kann. Doppel-rAF liegt sicher NACH dieser
    // Neuausrichtung; das 250-ms-Netz fängt Nachzügler (z. B. Ausricht-Animationen). Ohne das
    // sprang die Seite nach dem Blättern zurück in die Mitte, bis der nächste Sync sie rettete.
    const applySaved = () => {
      for (let j = 0; j < perView; j++) {
        if (gestureSlot.current === j) continue; // laufende Geste nie überschreiben
        const ref = transformRefs[j].current;
        if (!ref) continue;
        const saved = loadZoom(pageIndex + j);
        if (saved) {
          ref.setTransform(saved.x, saved.y, saved.scale, 0);
        } else {
          // Kein gespeicherter Zoom für DIESES Layout (z. B. nach Hochformat→Querformat-Wechsel:
          // anderer Layout-Schlüssel) → hängengebliebenen Transform auf Fit zurücksetzen, sonst
          // bleibt der Hochformat-Zoom in der Hälfte „stecken".
          const st = ref.instance?.transformState;
          if (st && st.scale > 1.01) ref.resetTransform(0);
        }
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(applySaved));
    const net = window.setTimeout(applySaved, 250);
    return () => window.clearTimeout(net);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pages, pageIndex, perView, syncTick]);

  // Strich-Bilder der Nachbarseiten vorab dekodieren → der Slide-Streifen kann sie beim
  // Blättern SOFORT (synchron) mitzeichnen, ohne auf Image-Decode zu warten.
  useEffect(() => {
    if (loading) return;
    for (let p = Math.max(0, pageIndex - 2); p <= Math.min(pageCount - 1, pageIndex + 3); p++) {
      const key = drawKeyFor(p);
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
    // Cache klein halten (älteste Einträge zuerst raus – Map behält die Einfüge-Reihenfolge).
    while (strokeImgCache.current.size > 20) {
      const oldest = strokeImgCache.current.keys().next().value;
      if (oldest === undefined) break;
      strokeImgCache.current.delete(oldest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, pageCount, syncTick, loading]);

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
      const key = drawKeyFor(p);
      const strokes = key ? strokeImgCache.current.get(key) : undefined;
      if (strokes && strokes.complete && strokes.naturalWidth > 0) ctx.drawImage(strokes, 0, 0);
      let texts: PageTextObj[] = [];
      try {
        const t = key ? localStorage.getItem(`${key}_text`) : null;
        texts = t ? (JSON.parse(t) as PageTextObj[]) : [];
      } catch {
        /* ignorieren */
      }
      out.push({ canvas: c, texts, zoom: loadZoom(p), aspect: `${src.width} / ${src.height}` });
    }
    return out;
  }

  // Slide auslösen, wenn sich NUR die Seite um ±1 ändert (Blättern). Layout-/Strom-Wechsel
  // (Drehen, Neuaufbau, Sprung übers Lied-Menü) schalten weiterhin hart um.
  useEffect(() => {
    const prev = prevPageIndex.current;
    prevPageIndex.current = pageIndex;
    const guard = slideGuard.current;
    slideGuard.current = { perView, pages };
    if (prev === null || loading) return;
    if (!guard || guard.perView !== perView || guard.pages !== pages) return;
    const delta = pageIndex - prev;
    if (Math.abs(delta) !== 1) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const old = composePane(prev);
    const neu = composePane(pageIndex);
    if (!old.length || !neu.length) return;
    slidePanes.current = { old, neu };
    setSlide({ dir: delta > 0 ? 1 : -1, tick: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, perView, pages, loading]);

  // Slide abspielen: Streifen (200 % breit, [links|rechts]-Hälften) horizontal schieben.
  useEffect(() => {
    if (!slide) return;
    const el = slideStripRef.current;
    if (!el) {
      setSlide(null);
      return;
    }
    // Text-Ebenen exakt auf die (unskalierte) Layout-Größe ihrer Seiten-Canvas bringen –
    // container-type:size macht die cqh-Schriftgrößen dann seitenrelativ wie in der Live-Ansicht.
    el.querySelectorAll<HTMLElement>('[data-slide-textlayer]').forEach((tl) => {
      const cv = tl.previousElementSibling as HTMLElement | null;
      if (cv) {
        tl.style.width = `${cv.offsetWidth}px`;
        tl.style.height = `${cv.offsetHeight}px`;
      }
    });
    const from = slide.dir === 1 ? '0%' : '-50%';
    const to = slide.dir === 1 ? '-50%' : '0%';
    el.style.transition = 'none';
    el.style.transform = `translateX(${from})`;
    void el.offsetWidth; // Reflow → Startposition steht, bevor die Transition beginnt
    el.style.transition = 'transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1)';
    el.style.transform = `translateX(${to})`;
    slideTimer.current = setTimeout(() => {
      slidePanes.current = null;
      setSlide(null);
    }, 300);
    return () => {
      if (slideTimer.current) clearTimeout(slideTimer.current);
    };
  }, [slide]);

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
    requestAnimationFrame(() => {
      for (let j = 0; j < perView; j++) {
        if (gestureSlot.current === j) continue; // laufende Geste nie überschreiben
        const ref = transformRefs[j].current;
        if (!ref) continue;
        const saved = loadZoom(pageIndex + j);
        if (saved) {
          ref.setTransform(saved.x, saved.y, saved.scale, 0);
        } else {
          // Kein Zoom für dieses Layout gespeichert (z. B. nach Formatwechsel) → Fit statt
          // hängengebliebenem Transform des vorherigen Layouts.
          const st = ref.instance?.transformState;
          if (st && st.scale > 1.01) ref.resetTransform(0);
        }
      }
    });
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
    requestAnimationFrame(() => {
      for (let j = 0; j < perView; j++) {
        if (gestureSlot.current === j) continue;
        const saved = loadZoom(pageIndex + j);
        if (saved) transformRefs[j].current?.setTransform(saved.x, saved.y, saved.scale, 0);
      }
    });
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
    requestAnimationFrame(() => {
      for (let j = 0; j < perView; j++) {
        if (gestureSlot.current === j) continue;
        const ref = transformRefs[j].current;
        if (!ref) continue;
        const saved = loadZoom(pageIndex + j);
        if (saved) {
          ref.setTransform(saved.x, saved.y, saved.scale, 0);
        } else {
          const st = ref.instance?.transformState;
          if (st && st.scale > 1.01) ref.resetTransform(0);
        }
      }
    });
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
      ctx.lineWidth = 18;
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
      ctx.lineWidth = 26;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
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
    const value = (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    d.confirmText(value, drawColor, textSize);
  }
  // Lock wieder freigeben, sobald die jeweilige Eingabe geschlossen/geöffnet wurde.
  useEffect(() => {
    textCommitLock.current[0] = false;
  }, [drawA.pending]);
  useEffect(() => {
    textCommitLock.current[1] = false;
  }, [drawB.pending]);

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
    d.placeText(fx, fy, e.clientX, e.clientY);
  }

  // Zieh-Knopf am Auswahlrahmen: Größe des ausgewählten Textes per Ziehen ändern.
  function handleResizeDown(e: React.PointerEvent, slot: number, id: number, size: number) {
    e.stopPropagation();
    const layer = layerRefs[slot].current;
    if (!layer) return;
    draws[slot].pushHistory();
    resizeDrag.current = { slot, id, startY: e.clientY, startSize: size, layerH: layer.clientHeight };
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

  // Zoom/Ausschnitt einer sichtbaren Seite automatisch sichern, sobald eine Geste endet (#33).
  // So bleibt ein freier Pinch-Zoom auch ohne „Fertig" erhalten – über die Sitzung und nach
  // Neuöffnen. Bei Rückkehr auf Fit (scale ≈ 1) wird der gespeicherte Zoom wieder entfernt.
  function persistZoom(slot: number) {
    // Nur echte Nutzer-Gesten sichern (beim Pinch/Pan hält gestureSlot diesen Slot) – NICHT das
    // programmatische Wiederherstellen, sonst wird der gerade geladene Wert quer über Lieder
    // zurückgeschrieben („bei allen Liedern gleich"). gestureSlot ist eine Ref → schon das ERSTE
    // onTransformed der Geste sieht den korrekten Slot (kein State-Timing-Loch).
    if (gestureSlot.current !== slot) return;
    const t = transformRefs[slot].current?.instance?.transformState;
    if (!t) return;
    const page = pageIndex + slot;
    if (t.scale > 1.01) {
      const zoom = { x: t.positionX, y: t.positionY, scale: t.scale };
      const zk = zoomKeyFor(page);
      try {
        localStorage.setItem(zk, JSON.stringify(zoom));
      } catch {
        /* Speicher voll */
      }
      pushField(zk, 'zoom', zoom);
    } else if (lastScale.current[slot] > 1.01) {
      // Nur löschen, wenn der Nutzer AKTIV wieder auf Fit herausgezoomt hat – nicht beim
      // programmatischen Zurücksetzen/Mounten (das würde einen gespeicherten Zoom fälschlich wipen).
      clearStoredZoom(page);
    }
    lastScale.current[slot] = t.scale;
  }

  // Gespeicherten Zoom einer Seite dauerhaft löschen (aktueller Layout-Schlüssel + Basis als Fallback).
  function clearStoredZoom(page: number) {
    for (const k of [zoomKeyFor(page), zoomKeyBaseFor(page)]) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignorieren */
      }
    }
    pushField(zoomKeyFor(page), 'zoom', null);
  }

  // Notausgang: sichtbare reingezoomte Seiten auf Normalgröße zurücksetzen UND ihren Speicher löschen.
  function resetVisibleZoom() {
    for (let j = 0; j < perView; j++) {
      if (!zoomedSlots[j]) continue;
      transformRefs[j].current?.resetTransform(150);
      clearStoredZoom(pageIndex + j);
    }
    gestureSlot.current = null;
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

  const label = !loading && !error && pageCount > 0 && !drawMode && pageLabel
    ? pageLabel(activePage, pageIndex, pageCount)
    : null;

  return (
    <div className={styles.root} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onClick}>
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
              {/* key = SEITE: beim Blättern wird die Zoom-Ebene frisch aufgebaut statt den
                  Transform-Zustand der vorherigen Seite dieser Hälfte zu erben. Der gespeicherte
                  Zoom der neuen Seite wird direkt danach vom Wiederherstell-Effekt angewandt →
                  eine Seite sieht links und rechts identisch aus. Beim Hintergrund-Neuaufbau
                  (pages-Tausch) bleibt der key gleich → kein Remount, laufende Gesten unberührt. */}
              <TransformWrapper
                key={`p${pageIndex + j}`}
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
                    // allein stehende Seite im Querformat (z. B. letzte Seite oder 2-Spalten-Lied
                    // auf einer Seite) gehört in die LINKE Hälfte wie ein normales linkes Blatt –
                    // NICHT über den ganzen Bildschirm zentriert. Nur im Hochformat (1 Spalte) mittig.
                    style={{ justifyItems: perView === 2 && slots.length === 1 ? 'start' : 'center' }}
                  >
                    <canvas ref={contentRefs[j]} className={styles.contentCanvas} />
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
                      {d.texts
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
                              // Text nur im Text-Werkzeug interaktiv → mit Stift/Marker kann man
                              // ungehindert DARÜBER zeichnen (sonst „fängt" der Text die Eingabe ab).
                              pointerEvents: drawMode && drawTool === 'text' ? 'all' : 'none',
                              cursor: 'grab',
                            }}
                            onPointerDown={(e) => d.startDrag(e, o)}
                            onPointerMove={(e) => d.moveDrag(e, o.id)}
                            onPointerUp={d.endDrag}
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
                          const editing = p.editId != null ? d.texts.find((t) => t.id === p.editId) : null;
                          return (
                            <span
                              key={`edit-${d.pending.editId ?? 'new'}`}
                              ref={(n) => {
                                editRefs.current[j] = n;
                                if (n && !n.dataset.init) {
                                  n.dataset.init = '1';
                                  n.textContent = p.initial ?? '';
                                  // Fokus + Cursor ans Ende (nach dem Mount, sonst schluckt iOS den Fokus).
                                  setTimeout(() => {
                                    n.focus();
                                    const range = document.createRange();
                                    range.selectNodeContents(n);
                                    range.collapse(false);
                                    const sel = window.getSelection();
                                    sel?.removeAllRanges();
                                    sel?.addRange(range);
                                  }, 0);
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
                                pointerEvents: 'all',
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              onBlur={() => commitInlineText(j)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  commitInlineText(j);
                                }
                                if (e.key === 'Escape') d.cancelText();
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
        <div className={styles.slideOverlay} aria-hidden="true">
          <div ref={slideStripRef} className={styles.slideStrip}>
            {[
              slide.dir === 1 ? slidePanes.current.old : slidePanes.current.neu,
              slide.dir === 1 ? slidePanes.current.neu : slidePanes.current.old,
            ].map((pane, pi) => (
              <div key={pi} className={styles.slidePane}>
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
                          style={{ justifyItems: perView === 2 && pane.length === 1 ? 'start' : 'center' }}
                          ref={(n) => {
                            if (n && s.canvas.parentElement !== n) {
                              s.canvas.className = styles.contentCanvas;
                              n.insertBefore(s.canvas, n.firstChild);
                            }
                          }}
                        >
                          <div data-slide-textlayer className={styles.textLayer} style={{ aspectRatio: s.aspect }}>
                            {s.texts.map((o) => (
                              <div
                                key={o.id}
                                className={styles.textObj}
                                style={{
                                  left: `${o.fx * 100}%`,
                                  top: `${o.fy * 100}%`,
                                  fontSize: `${o.sizeCqh}cqh`,
                                  color: o.color,
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
          onSelectedColor={(c) => activeDraw.selectedId !== null && activeDraw.setColor(activeDraw.selectedId, c)}
          onSelectedResize={(delta) => activeDraw.selectedId !== null && activeDraw.resize(activeDraw.selectedId, delta)}
          onUndo={activeDraw.undo}
          canUndo={activeDraw.canUndo}
          onRedo={activeDraw.redo}
          canRedo={activeDraw.canRedo}
          onDeleteSelected={() => activeDraw.selectedId !== null && activeDraw.deleteText(activeDraw.selectedId)}
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
