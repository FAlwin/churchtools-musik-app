import { useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SetlistPageOwner } from '../utils/chordPdf';
import type { DrawTool } from '../types/index';
import { Icon } from './icons';
import { Spinner } from './Spinner';
import styles from './StreamView.module.scss';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface StreamViewProps {
  /** Zusammengefasste PDF des ganzen Ablaufs (alle Lieder hintereinander). */
  pdfData: ArrayBuffer;
  /** Pro PDF-Seite das zugehörige Lied + die Seite darin (für Anmerkungs-Schlüssel & aktives Lied). */
  owners: SetlistPageOwner[];
  /** Linke (erste) sichtbare Seite im Strom. */
  pageIndex: number;
  onPageIndex: (i: number) => void;
  /** Aktive Seite (im 2-up die angetippte Hälfte) – steuert Kopfzeile/Menüs. */
  activePage: number;
  onActivePage: (i: number) => void;
  drawMode: boolean;
  drawColor: string;
  drawTool: DrawTool;
  /** Löscht die Anmerkungen der AKTIVEN Seite (Zähler). */
  clearSignal: number;
}

function isLandscape(): boolean {
  return window.innerWidth > window.innerHeight;
}

/**
 * Durchgehender Seitenstrom über den ganzen Ablauf. Hochformat zeigt 1 Seite, Querformat IMMER 2
 * Seiten nebeneinander (auch über Liedgrenzen) – jede Seite ein eigener Bereich mit EIGENEM Zoom.
 * Wischen blättert um 1 Seite (rechte rückt nach links), Antippen einer Hälfte macht sie aktiv.
 * Eine Zoom-Geste schaltet pro Seite einen Anpassen-Modus (✓/✗) frei; solange der an ist, ist
 * Wischen/Tippen aus – danach wieder normal.
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
  drawTool,
  clearSignal,
}: StreamViewProps) {
  const pagesRef = useRef<HTMLCanvasElement[]>([]); // alle Seiten offscreen gerendert
  const contentRefs = [useRef<HTMLCanvasElement | null>(null), useRef<HTMLCanvasElement | null>(null)];
  const annoRefs = [useRef<HTMLCanvasElement | null>(null), useRef<HTMLCanvasElement | null>(null)];
  const transformRefs = [useRef<ReactZoomPanPinchRef | null>(null), useRef<ReactZoomPanPinchRef | null>(null)];
  const drawing = useRef(false);
  const drawCanvas = useRef<HTMLCanvasElement | null>(null);
  const drawPage = useRef(0);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [renderVersion, setRenderVersion] = useState(0);
  const [landscape, setLandscape] = useState(isLandscape());
  const [adjustSlot, setAdjustSlot] = useState<number | null>(null); // Seite im Zoom-Anpassen-Modus
  const firstDone = useRef(false);

  const perView = landscape ? 2 : 1;
  const adjusting = adjustSlot !== null;

  const keyFor = (page: number): string => {
    const o = owners[page];
    return o ? `worship_docdraw_song${o.songId}_${o.localPage}` : `worship_docdraw_p${page}`;
  };
  const zoomKeyFor = (page: number): string => {
    const o = owners[page];
    return o ? `worship_doczoom_song${o.songId}_${o.localPage}` : `worship_doczoom_p${page}`;
  };
  function loadZoom(page: number): { x: number; y: number; scale: number } | null {
    try {
      const s = localStorage.getItem(zoomKeyFor(page));
      if (s) {
        const o = JSON.parse(s);
        if (o && typeof o.scale === 'number') return o;
      }
    } catch {
      /* ignorieren */
    }
    return null;
  }

  // Ausrichtung verfolgen
  useEffect(() => {
    const onResize = () => setLandscape(isLandscape());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // PDF laden → jede Seite offscreen rendern. Beim ERSTEN Mal Spinner; bei späteren Neu-Erzeugungen
  // (Transponieren etc.) im Hintergrund rendern und die alten Seiten stehen lassen, bis fertig.
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

  // Sichtbare Seiten malen + Anmerkungen laden
  useEffect(() => {
    if (loading) return;
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
      const saved = localStorage.getItem(keyFor(pageIndex + j));
      if (saved) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = saved;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, renderVersion, pageIndex, perView]);

  // Aktive Seite immer im sichtbaren Fenster halten (Hochformat: = sichtbare Seite).
  useEffect(() => {
    const maxVisible = pageIndex + perView - 1;
    if (activePage < pageIndex || activePage > maxVisible) onActivePage(pageIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perView, pageIndex, activePage]);

  // Beim Blättern/Drehen Zoom-Modus verlassen und den GESPEICHERTEN Zoom der Seite wiederherstellen
  // (oder auf Fit, falls keiner gespeichert ist) – Zoom ist so dauerhaft pro Lied-Seite.
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
  }, [pageIndex, perView, loading]);

  // Anmerkungen der aktiven Seite löschen
  useEffect(() => {
    if (clearSignal === 0) return;
    const j = activePage - pageIndex;
    const anno = annoRefs[j]?.current;
    if (anno) anno.getContext('2d')!.clearRect(0, 0, anno.width, anno.height);
    localStorage.removeItem(keyFor(activePage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSignal]);

  // ── Zeichnen ──
  function pt(e: React.PointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
  function dDown(e: React.PointerEvent, slot: number) {
    if (!drawMode) return;
    const canvas = annoRefs[slot].current;
    if (!canvas) return;
    drawing.current = true;
    drawCanvas.current = canvas;
    drawPage.current = pageIndex + slot;
    lastPt.current = pt(e, canvas);
  }
  function dMove(e: React.PointerEvent) {
    if (!drawMode || !drawing.current || !drawCanvas.current) return;
    const ctx = drawCanvas.current.getContext('2d')!;
    const p = pt(e, drawCanvas.current);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.lineWidth = 26;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (drawTool === 'marker') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 16;
      ctx.strokeStyle = drawColor;
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
  function dUp() {
    if (!drawing.current || !drawCanvas.current) return;
    drawing.current = false;
    lastPt.current = null;
    try {
      localStorage.setItem(keyFor(drawPage.current), drawCanvas.current.toDataURL('image/png', 0.7));
    } catch {
      /* Speicher voll */
    }
    drawCanvas.current = null;
  }

  // ── Blättern (Wischen) / aktive Hälfte (Tippen) ──
  function go(delta: number) {
    const nextP = Math.min(Math.max(0, pageIndex + delta), Math.max(0, pageCount - 1));
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
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      go(dx > 0 ? 1 : -1);
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      tapAt(startX, e.currentTarget as HTMLElement);
    }
  }
  function tapAt(clientX: number, root: HTMLElement) {
    if (perView < 2) return;
    const r = root.getBoundingClientRect();
    const slot = clientX - r.left < r.width / 2 ? 0 : 1;
    const target = pageIndex + slot;
    if (target < pageCount) onActivePage(target);
  }
  function onClick(e: React.MouseEvent) {
    if (drawMode || adjusting) return;
    tapAt(e.clientX, e.currentTarget as HTMLElement);
  }

  function confirmAdjust() {
    // aktuelle (gezoomte) Ansicht der Seite dauerhaft speichern
    if (adjustSlot !== null) {
      const ref = transformRefs[adjustSlot].current;
      const t = ref?.instance?.transformState;
      if (t) {
        try {
          localStorage.setItem(
            zoomKeyFor(pageIndex + adjustSlot),
            JSON.stringify({ x: t.positionX, y: t.positionY, scale: t.scale }),
          );
        } catch {
          /* Speicher voll */
        }
      }
    }
    setAdjustSlot(null);
  }
  function cancelAdjust() {
    if (adjustSlot !== null) {
      transformRefs[adjustSlot].current?.resetTransform(150);
      localStorage.removeItem(zoomKeyFor(pageIndex + adjustSlot));
    }
    setAdjustSlot(null);
  }

  const slots: number[] = [];
  for (let j = 0; j < perView; j++) {
    if (pageIndex + j >= pageCount) break;
    slots.push(j);
  }

  return (
    <div className={styles.root} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onClick}>
      {loading && (
        <div className={styles.center}>
          <Spinner />
          <span>Lieder werden vorbereitet…</span>
        </div>
      )}
      {error && <div className={styles.center}>⚠️ {error}</div>}

      <div className={styles.row} style={{ visibility: loading ? 'hidden' : 'visible' }}>
        {slots.map((j) => (
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
            >
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%' }}
              >
                <div className={styles.pageBox}>
                  <canvas ref={contentRefs[j]} className={styles.contentCanvas} />
                  <canvas
                    ref={annoRefs[j]}
                    className={styles.annoCanvas}
                    style={{ pointerEvents: drawMode ? 'all' : 'none', cursor: drawMode ? 'crosshair' : 'default' }}
                    onPointerDown={(e) => dDown(e, j)}
                    onPointerMove={dMove}
                    onPointerUp={dUp}
                    onPointerLeave={dUp}
                  />
                </div>
              </TransformComponent>
            </TransformWrapper>
          </div>
        ))}
      </div>

      {/* Zoom-Anpassen-Knöpfe (erscheinen nach einer Zoom-Geste) */}
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

      {!loading && !error && pageCount > 0 && (
        <div className={styles.pageBadge}>
          Seite {pageIndex + 1}
          {perView > 1 && pageIndex + 1 < pageCount ? `–${Math.min(pageIndex + perView, pageCount)}` : ''} / {pageCount}
        </div>
      )}
    </div>
  );
}
