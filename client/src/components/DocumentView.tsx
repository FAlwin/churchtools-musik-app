import { useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SongDocument } from '@shared/types/index';
import type { DrawTool } from '../types/index';
import { Spinner } from './Spinner';
import styles from './DocumentView.module.scss';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface DocumentViewProps {
  songId: number;
  /** Hochgeladenes Dokument (PDF/Bild) aus ChurchTools. Alternativ: `pdfData`. */
  doc?: SongDocument | null;
  /** In-App erzeugte PDF (aus ChordPro). Hat Vorrang vor `doc`. */
  pdfData?: ArrayBuffer | null;
  /** Schlüssel-Basis für Anmerkungen/Zoom bei erzeugter PDF (z. B. `song123`),
   *  damit Anmerkungen pro Lied erhalten bleiben, auch wenn neu erzeugt wird. */
  storeId?: string;
  drawMode: boolean;
  drawColor: string;
  drawTool: DrawTool;
  clearSignal: number;
  /** Anpassen-Modus (Zoom/Verschieben) – gesteuert von der Kopfleiste. */
  adjust: boolean;
  onAdjustChange: (v: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Dokument-Anzeige (PDF/Bild) als Ersatz für den Chord-Text.
 * - Mehrseitige PDFs: pro Seite eine Ansicht, Wischen/Tippen blättert (am Rand → Lied).
 * - „Anpassen"-Modus: zum Zoomen/Verschieben; mit „Fertig" wieder fixieren.
 * - Anmerkungen pro Seite über die gemeinsame Werkzeugleiste der Chart-Ansicht.
 */
export function DocumentView({
  songId,
  doc,
  pdfData,
  storeId,
  drawMode,
  drawColor,
  drawTool,
  clearSignal,
  adjust,
  onAdjustChange,
  onPrev,
  onNext,
}: DocumentViewProps) {
  const pagesRef = useRef<HTMLCanvasElement[]>([]); // gerenderte Seiten (offscreen)
  const contentRef = useRef<HTMLCanvasElement | null>(null);
  const annoRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const lastTf = useRef({ scale: 1, positionX: 0, positionY: 0 }); // letzter Zoom/Ausschnitt

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [pageIndex, setPageIndex] = useState(0);

  const url = doc ? `/api/songs/${songId}/files/${doc.fileId}` : '';
  // Schlüssel-Basis: erzeugte PDF → pro Lied (storeId), sonst pro Datei.
  const keyBase = pdfData ? (storeId ?? `song${songId}`) : `${doc?.fileId ?? 'none'}`;
  const storeKey = (p: number) => `worship_docdraw_${keyBase}_${p}`;

  // Dokument laden → jede Seite in eine eigene (offscreen) Leinwand rendern
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    pagesRef.current = [];
    setPageIndex(0);

    async function load() {
      if (pdfData) {
        // In-App erzeugte PDF (aus ChordPro). slice(0) → eigene Kopie, da pdf.js den Puffer
        // ggf. übernimmt (StrictMode-Doppelaufruf würde sonst auf einen detachten Puffer treffen).
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
      } else if (doc?.type === 'image') {
        const img = new Image();
        img.crossOrigin = 'use-credentials';
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error('Bild konnte nicht geladen werden'));
          img.src = url;
        });
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        pagesRef.current = [c];
        setPageCount(1);
      } else {
        const pdf = await pdfjsLib.getDocument({ url, withCredentials: true }).promise;
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
      }
    }

    load()
      .then(() => !cancelled && setLoading(false))
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Dokument konnte nicht geladen werden.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, doc?.type, pdfData]);

  // Aktuelle Seite anzeigen + Anmerkungs-Leinwand vorbereiten
  useEffect(() => {
    if (loading) return;
    const src = pagesRef.current[pageIndex];
    const content = contentRef.current;
    const anno = annoRef.current;
    if (!src || !content || !anno) return;
    content.width = src.width;
    content.height = src.height;
    content.getContext('2d')!.drawImage(src, 0, 0);
    anno.width = src.width;
    anno.height = src.height;
    anno.getContext('2d')!.clearRect(0, 0, anno.width, anno.height);
    const saved = localStorage.getItem(storeKey(pageIndex));
    if (saved) {
      const img = new Image();
      img.onload = () => annoRef.current?.getContext('2d')?.drawImage(img, 0, 0);
      img.src = saved;
    }
    // Zoom-Wiederherstellung passiert über key + initiale Transform-Props (siehe unten)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pageIndex]);

  // Löschen (aktuelle Seite) über gemeinsame Werkzeugleiste
  useEffect(() => {
    if (clearSignal === 0) return;
    const anno = annoRef.current;
    if (!anno) return;
    anno.getContext('2d')!.clearRect(0, 0, anno.width, anno.height);
    localStorage.removeItem(storeKey(pageIndex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSignal]);

  // ── Zeichnen ──
  function pt(e: React.PointerEvent) {
    const c = annoRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * c.width, y: ((e.clientY - rect.top) / rect.height) * c.height };
  }
  function dDown(e: React.PointerEvent) {
    if (!drawMode || drawTool === 'text') return;
    drawing.current = true;
    lastPt.current = pt(e);
  }
  function dMove(e: React.PointerEvent) {
    if (!drawMode || !drawing.current) return;
    const ctx = annoRef.current!.getContext('2d')!;
    const p = pt(e);
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
    if (!drawing.current) return;
    drawing.current = false;
    lastPt.current = null;
    try {
      localStorage.setItem(storeKey(pageIndex), annoRef.current!.toDataURL('image/png', 0.7));
    } catch {
      /* Speicher voll */
    }
  }

  // ── Blättern / Liednavigation (nur fixiert, ohne Zeichnen) ──
  function pageForward() {
    if (pageIndex < pageCount - 1) setPageIndex(pageIndex + 1);
    else onNext();
  }
  function pageBackward() {
    if (pageIndex > 0) setPageIndex(pageIndex - 1);
    else onPrev();
  }
  function rootClick(e: React.MouseEvent) {
    if (drawMode || adjust) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (x < r.width * 0.24) pageBackward();
    else if (x > r.width * 0.76) pageForward();
  }
  function rootTouchStart(e: React.TouchEvent) {
    if (drawMode || adjust) return;
    if (e.touches.length >= 2) {
      onAdjustChange(true); // zwei Finger = Anpassen-Modus
      swipeStart.current = null;
      return;
    }
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function rootTouchEnd(e: React.TouchEvent) {
    if (drawMode || adjust || !swipeStart.current) return;
    const dx = swipeStart.current.x - e.changedTouches[0].clientX;
    const dy = swipeStart.current.y - e.changedTouches[0].clientY;
    swipeStart.current = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx > 0) pageForward();
      else pageBackward();
    }
  }

  return (
    <div className={styles.root} onClick={rootClick} onTouchStart={rootTouchStart} onTouchEnd={rootTouchEnd}>
      {loading && (
        <div className={styles.center}>
          <Spinner />
          <span>Dokument wird geladen…</span>
        </div>
      )}
      {error && <div className={styles.center}>⚠️ {error}</div>}

      {/* Pro Seite eine eigene Zoom-Ebene (key) – startet mit dem gespeicherten Zoom */}
      <TransformWrapper
        key={`${keyBase}-${pageIndex}`}
        ref={transformRef}
        minScale={0.4}
        maxScale={8}
        centerOnInit
        initialScale={1}
        limitToBounds={false}
        doubleClick={{ disabled: true }}
        panning={{ disabled: !adjust, velocityDisabled: true }}
        wheel={{ disabled: !adjust, step: 0.08 }}
        pinch={{ disabled: !adjust }}
        onTransformed={(_ref, state) => {
          // Zoom NICHT mehr persistent speichern – die Seite startet immer höhenfüllend (Fit).
          lastTf.current = { scale: state.scale, positionX: state.positionX, positionY: state.positionY };
        }}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div className={styles.pageBox} style={{ visibility: loading ? 'hidden' : 'visible' }}>
            <canvas ref={contentRef} className={styles.contentCanvas} />
            <canvas
              ref={annoRef}
              className={styles.annoCanvas}
              style={{ pointerEvents: drawMode ? 'all' : 'none', cursor: drawMode ? 'crosshair' : 'default' }}
              onPointerDown={dDown}
              onPointerMove={dMove}
              onPointerUp={dUp}
              onPointerLeave={dUp}
            />
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* Seiten-Anzeige unten rechts (wie bei ChordPro-Seiten) */}
      {!loading && !error && pageCount > 1 && (
        <button
          className={styles.pageBadge}
          onClick={(e) => {
            e.stopPropagation();
            pageForward();
          }}
        >
          Seite {pageIndex + 1} / {pageCount}
          <span className={styles.pageBadgeArrow}>›</span>
        </button>
      )}
    </div>
  );
}
