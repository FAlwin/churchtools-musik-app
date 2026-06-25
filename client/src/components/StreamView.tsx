import { useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SetlistPageOwner } from '../utils/chordPdf';
import type { DrawTool } from '../types/index';
import { usePageDraw } from '../hooks/usePageDraw';
import { pushField } from '../services/annotations';
import { deviceClass } from '../utils/deviceClass';
import { DrawToolbar } from './DrawToolbar';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './icons';
import { Spinner } from './Spinner';
import styles from './StreamView.module.scss';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface StreamViewProps {
  pdfData: ArrayBuffer;
  owners: SetlistPageOwner[];
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
  return window.innerWidth > window.innerHeight;
}

/**
 * Durchgehender Seitenstrom über den ganzen Ablauf. Hochformat 1 Seite, Querformat IMMER 2 Seiten
 * nebeneinander – jede Seite ein eigener Bereich mit eigenem Zoom (dauerhaft gespeichert) und
 * vollen Anmerkungen (Stift/Marker/Radierer + Textfelder + Rückgängig), persistiert pro Lied-Seite.
 */
export function StreamView({
  pdfData,
  owners,
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
}: StreamViewProps) {
  const pagesRef = useRef<HTMLCanvasElement[]>([]);
  const contentRefs = [useRef<HTMLCanvasElement | null>(null), useRef<HTMLCanvasElement | null>(null)];
  const annoRefs = [useRef<HTMLCanvasElement | null>(null), useRef<HTMLCanvasElement | null>(null)];
  const layerRefs = [useRef<HTMLDivElement | null>(null), useRef<HTMLDivElement | null>(null)];
  const transformRefs = [useRef<ReactZoomPanPinchRef | null>(null), useRef<ReactZoomPanPinchRef | null>(null)];
  // Marker glatt: aktiver Strich wird als EINE Linie aus allen Punkten neu gezeichnet (auf einem
  // Schnappschuss der Seite vor dem Strich) → keine pro-Segment-Überlagerung mehr (kein „Gepunktel").
  const markerBase = useRef<HTMLCanvasElement | null>(null);
  const markerPts = useRef<{ x: number; y: number }[]>([]);
  const stroke = useRef(false);
  const strokePointer = useRef(-1);
  const strokeCanvas = useRef<HTMLCanvasElement | null>(null);
  const strokeSlot = useRef(0);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false); // verhindert doppelte Navigation (Touch löst auch click aus)

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [renderVersion, setRenderVersion] = useState(0);
  const [landscape, setLandscape] = useState(isLandscape());
  const [adjustSlot, setAdjustSlot] = useState<number | null>(null);
  // Welche sichtbaren Seiten gerade reingezoomt sind (auch geladener Zoom) → Notausgang-Knopf.
  const [zoomedSlots, setZoomedSlots] = useState<[boolean, boolean]>([false, false]);
  const [aspects, setAspects] = useState<string[]>(['210 / 297', '210 / 297']);
  const [textSize, setTextSize] = useState(4); // cqh = % der Seitenhöhe
  const [confirmClear, setConfirmClear] = useState(false);
  const firstDone = useRef(false);

  const perView = landscape ? 2 : 1;
  const adjusting = adjustSlot !== null;

  const keyFor = (page: number): string | null => {
    const o = owners[page];
    return o ? `worship_docdraw_song${o.songId}_v${o.versionKey}_${o.localPage}` : null;
  };
  // Zoom ist display-abhängig → Geräteklasse im Schlüssel (Handy vs. Tablet+Computer).
  const zoomKeyFor = (page: number): string => {
    const o = owners[page];
    return o
      ? `worship_doczoom_song${o.songId}_v${o.versionKey}_${o.localPage}_d${deviceClass()}`
      : `worship_doczoom_p${page}`;
  };
  function loadZoom(page: number): { x: number; y: number; scale: number } | null {
    const o = owners[page];
    // Primär klassen-spezifischer Schlüssel; Fallback auf früher gespeicherten Zoom ohne Klassen-Suffix.
    const keys = [zoomKeyFor(page)];
    if (o) keys.push(`worship_doczoom_song${o.songId}_v${o.versionKey}_${o.localPage}`);
    for (const k of keys) {
      try {
        const s = localStorage.getItem(k);
        if (s) {
          const parsed = JSON.parse(s);
          if (parsed && typeof parsed.scale === 'number') return parsed;
        }
      } catch {
        /* ignorieren */
      }
    }
    return null;
  }

  // Ein Anmerkungs-Zustand je sichtbarer Seite (fixe Anzahl Hooks – Regeln der Hooks).
  const drawA = usePageDraw(keyFor(pageIndex), annoRefs[0], layerRefs[0], syncTick);
  const drawB = usePageDraw(keyFor(pageIndex + 1), annoRefs[1], layerRefs[1], syncTick);
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

  // PDF laden (erstes Mal Spinner, später im Hintergrund tauschen)
  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      const pdf = await pdfjsLib.getDocument({ data: pdfData.slice(0) }).promise;
      const canvases: HTMLCanvasElement[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 2 });
        const c = document.createElement('canvas');
        c.width = Math.ceil(vp.width);
        c.height = Math.ceil(vp.height);
        await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
        if (cancelled) return;
        canvases.push(c);
      }
      pagesRef.current = canvases;
      setPageCount(canvases.length);
      setRenderVersion((v) => v + 1);
    })()
      .then(() => {
        if (!cancelled) {
          firstDone.current = true;
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Konnte nicht geladen werden.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pdfData]);

  // Sichtbare Seiten malen + Striche laden + Seitenverhältnis setzen
  useEffect(() => {
    if (loading) return;
    const nextAspects = [...aspects];
    for (let j = 0; j < perView; j++) {
      const content = contentRefs[j].current;
      const anno = annoRefs[j].current;
      if (!content || !anno) continue;
      const src = pagesRef.current[pageIndex + j];
      if (!src) continue;
      content.width = src.width;
      content.height = src.height;
      content.getContext('2d')!.drawImage(src, 0, 0);
      anno.width = src.width;
      anno.height = src.height;
      const ctx = anno.getContext('2d')!;
      ctx.clearRect(0, 0, anno.width, anno.height);
      const key = keyFor(pageIndex + j);
      const saved = key ? localStorage.getItem(key) : null;
      if (saved) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = saved;
      }
      nextAspects[j] = `${src.width} / ${src.height}`;
    }
    setAspects(nextAspects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, renderVersion, pageIndex, perView, syncTick]);

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
  }, [perView, loading, renderVersion, pageIndex]);

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

  // Beim Blättern/Drehen Zoom-Modus verlassen + gespeicherten Zoom je Seite wiederherstellen
  useEffect(() => {
    setAdjustSlot(null);
    if (loading) return;
    requestAnimationFrame(() => {
      for (let j = 0; j < perView; j++) {
        const ref = transformRefs[j].current;
        if (!ref) continue;
        const saved = loadZoom(pageIndex + j);
        if (saved) ref.setTransform(saved.x, saved.y, saved.scale, 0);
        else ref.resetTransform(0);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, perView, loading, syncTick]);

  // ── Striche zeichnen (auf der Anno-Canvas der jeweiligen Seite) ──
  function ptOf(e: React.PointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
  function strokeDown(e: React.PointerEvent, slot: number) {
    if (!drawMode || drawTool === 'text') return;
    // Nur der primäre Finger zeichnet (zweiter Finger beim Multitouch wird ignoriert).
    if (e.pointerType === 'touch' && !e.isPrimary) return;
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
    draws[slot].setSelectedId(null);
    draws[slot].pushHistory();
    stroke.current = true;
    strokePointer.current = e.pointerId;
    strokeCanvas.current = canvas;
    strokeSlot.current = slot;
    lastPt.current = ptOf(e, canvas);
    if (drawTool === 'marker') {
      // Seite vor dem Strich sichern, damit der Marker-Strich live als eine Linie neu gemalt wird.
      const base = document.createElement('canvas');
      base.width = canvas.width;
      base.height = canvas.height;
      base.getContext('2d')!.drawImage(canvas, 0, 0);
      markerBase.current = base;
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
    lastPt.current = null;
    markerBase.current = null;
    markerPts.current = [];
    draws[strokeSlot.current].saveStrokes();
    strokeCanvas.current = null;
  }

  // Text platzieren (Tipp mit Text-Werkzeug auf leere Stelle der Seite)
  function layerDown(e: React.PointerEvent, slot: number) {
    if (!drawMode || drawTool !== 'text') return;
    const layer = layerRefs[slot].current;
    if (!layer) return;
    e.stopPropagation();
    const d = draws[slot];
    // Ist ein Eingabefeld offen? → nur schließen (onBlur bestätigt), KEIN neues Feld anlegen.
    if (d.pending) return;
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

  // ── Blättern / aktive Hälfte ──
  // Max. linke Seite: im 2-up so, dass NIE eine Seite allein rechts steht (immer 2 sichtbar);
  // nur bei genau 1 Seite gesamt bleibt eine einzelne (linksbündige) Seite.
  const maxLeft = perView === 2 && pageCount > 1 ? pageCount - 2 : Math.max(0, pageCount - 1);
  function go(delta: number) {
    const nextP = Math.min(Math.max(0, pageIndex + delta), maxLeft);
    if (nextP !== pageIndex) {
      onPageIndex(nextP);
      onActivePage(nextP);
    }
  }
  function onTouchStart(e: React.TouchEvent) {
    if (drawMode || adjusting || e.touches.length > 1) {
      touchStart.current = null;
      return;
    }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (drawMode || adjusting || !touchStart.current) return;
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
    if (drawMode || adjusting) return;
    if (suppressClick.current) {
      suppressClick.current = false; // war ein Touch-Tap (schon behandelt) → Klick ignorieren
      return;
    }
    tapAt(e.clientX, e.currentTarget as HTMLElement);
  }

  function confirmAdjust() {
    if (adjustSlot !== null) {
      const t = transformRefs[adjustSlot].current?.instance?.transformState;
      if (t) {
        const zoom = { x: t.positionX, y: t.positionY, scale: t.scale };
        const zk = zoomKeyFor(pageIndex + adjustSlot);
        try {
          localStorage.setItem(zk, JSON.stringify(zoom));
        } catch {
          /* Speicher voll */
        }
        pushField(zk, 'zoom', zoom);
      }
    }
    setAdjustSlot(null);
  }
  function cancelAdjust() {
    if (adjustSlot !== null) {
      transformRefs[adjustSlot].current?.resetTransform(150);
      const zk = zoomKeyFor(pageIndex + adjustSlot);
      localStorage.removeItem(zk);
      pushField(zk, 'zoom', null);
    }
    setAdjustSlot(null);
  }

  // Gespeicherten Zoom einer Seite dauerhaft löschen (klassen-spezifischer + alter Fallback-Schlüssel).
  function clearStoredZoom(page: number) {
    const o = owners[page];
    const keys = [zoomKeyFor(page)];
    if (o) keys.push(`worship_doczoom_song${o.songId}_v${o.versionKey}_${o.localPage}`);
    for (const k of keys) {
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
    setAdjustSlot(null);
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

  return (
    <div className={styles.root} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onClick}>
      {loading && (
        <div className={styles.center}>
          <Spinner />
          <span>Lieder werden vorbereitet…</span>
        </div>
      )}
      {error && <div className={styles.center}>⚠️ {error}</div>}
      {!loading && slots.length === 2 && <div className={styles.divider} />}

      <div className={styles.row} style={{ visibility: loading ? 'hidden' : 'visible' }}>
        {slots.map((j) => {
          const d = draws[j];
          return (
            <div key={j} className={styles.slot}>
              <TransformWrapper
                ref={transformRefs[j]}
                minScale={1}
                maxScale={6}
                centerOnInit
                centerZoomedOut
                initialScale={1}
                limitToBounds
                doubleClick={{ disabled: true }}
                panning={{ disabled: drawMode || adjustSlot !== j, velocityDisabled: true }}
                pinch={{ disabled: drawMode }}
                wheel={{ disabled: drawMode, step: 0.08 }}
                onZoomStart={() => {
                  if (!drawMode) setAdjustSlot(j);
                }}
                onTransformed={(_ref, state) => {
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
                      {d.texts.map((o) => (
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
                        </div>
                      ))}
                    </div>
                  </div>
                </TransformComponent>
              </TransformWrapper>
            </div>
          );
        })}
      </div>

      {/* Text-Eingabe-Leiste: feste Position oben (immer über der Tastatur, kein „Schweben"). */}
      {slots.map((j) => {
        const d = draws[j];
        if (!d.pending) return null;
        // Beim Tippen der Werkzeug-Knöpfe NICHT den Fokus/Tastatur verlieren.
        const keepFocus = (e: React.PointerEvent) => e.preventDefault();
        return (
          <div key={`in${j}`} className={styles.textBar}>
            <button
              className={styles.textBarSizeBtn}
              onPointerDown={keepFocus}
              onClick={() => setTextSize((s) => Math.max(2, s - 1))}
              title="Kleiner"
            >
              A−
            </button>
            <span className={styles.textBarSize}>{textSize}</span>
            <button
              className={styles.textBarSizeBtn}
              onPointerDown={keepFocus}
              onClick={() => setTextSize((s) => Math.min(14, s + 1))}
              title="Größer"
            >
              A+
            </button>
            <input
              type="text"
              autoFocus
              defaultValue={d.pending.initial ?? ''}
              placeholder="Text eingeben…"
              className={styles.textBarInput}
              style={{ color: drawColor }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') d.confirmText((e.target as HTMLInputElement).value, drawColor, textSize);
                if (e.key === 'Escape') d.cancelText();
              }}
            />
            <button
              className={styles.textBarOk}
              onPointerDown={keepFocus}
              onClick={(e) => {
                const inp = (e.currentTarget.parentElement as HTMLElement).querySelector('input');
                d.confirmText(inp ? inp.value : '', drawColor, textSize);
              }}
            >
              OK
            </button>
            <button className={styles.textBarCancel} onPointerDown={keepFocus} onClick={() => d.cancelText()} title="Abbrechen">
              ✕
            </button>
          </div>
        );
      })}

      {/* Werkzeugleiste (volle Anmerkungen für die aktive Seite) */}
      {drawMode && (
        <DrawToolbar
          colors={drawColors}
          drawColor={drawColor}
          setDrawColor={setDrawColor}
          drawTool={drawTool}
          setDrawTool={(t) => {
            activeDraw.setSelectedId(null);
            setDrawTool(t);
          }}
          textSize={textSize}
          setTextSize={setTextSize}
          sizeStep={1}
          sizeMin={2}
          sizeMax={14}
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

      {adjusting && (
        <div className={styles.zoomBar}>
          <button className={styles.zoomCancel} onClick={cancelAdjust} aria-label="Zoom verwerfen">
            <Icon name="chev-left" size={16} stroke={2.4} /> Zurück
          </button>
          <button className={styles.zoomOk} onClick={confirmAdjust} aria-label="Ansicht behalten">
            <Icon name="check" size={16} stroke={2.6} /> Fertig
          </button>
        </div>
      )}

      {/* Seitenzahl nur bei MEHRSEITIGEN Liedern – zeigt „Lied noch nicht zu Ende". Einseitig: Pfeile reichen. */}
      {!loading &&
        !error &&
        pageCount > 0 &&
        !drawMode &&
        (() => {
          const cur = owners[activePage] ?? owners[pageIndex];
          if (!cur) return null;
          const songPages = owners.filter((o) => o.songIdx === cur.songIdx).length;
          if (songPages <= 1) return null; // einseitiges Lied → kein Indikator
          return (
            <div className={styles.pageBadge}>
              Seite {cur.localPage + 1} / {songPages}
            </div>
          );
        })()}
    </div>
  );
}
