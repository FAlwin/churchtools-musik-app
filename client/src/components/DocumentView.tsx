import { useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SongDocument } from '@shared/types/index';
import { Spinner } from './Spinner';
import { DRAW_COLORS } from '../utils/constants';
import styles from './DocumentView.module.scss';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface DocumentViewProps {
  songId: number;
  doc: SongDocument;
}

/**
 * Einbettbare Dokument-Anzeige (PDF/Bild) als Ersatz für den Chord-Text –
 * zoom-/verschiebbar mit Anmerkungs-Ebene. Füllt den Eltern-Container.
 */
export function DocumentView({ songId, doc }: DocumentViewProps) {
  const contentRef = useRef<HTMLCanvasElement | null>(null);
  const annoRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [color, setColor] = useState(DRAW_COLORS[0]);

  const url = `/api/songs/${songId}/files/${doc.fileId}`;
  const storeKey = `worship_docdraw_${doc.fileId}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDims(null);

    async function renderImage() {
      const img = new Image();
      img.crossOrigin = 'use-credentials';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
        img.src = url;
      });
      if (cancelled) return;
      const canvas = contentRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      setDims({ w: img.naturalWidth, h: img.naturalHeight });
    }

    async function renderPdf() {
      const pdf = await pdfjsLib.getDocument({ url, withCredentials: true }).promise;
      const scale = 2;
      const rendered: { page: pdfjsLib.PDFPageProxy; vp: pdfjsLib.PageViewport }[] = [];
      let totalH = 0;
      let maxW = 0;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale });
        rendered.push({ page, vp });
        totalH += Math.ceil(vp.height) + (i > 1 ? 16 : 0);
        maxW = Math.max(maxW, Math.ceil(vp.width));
      }
      if (cancelled) return;
      const canvas = contentRef.current!;
      canvas.width = maxW;
      canvas.height = totalH;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, maxW, totalH);
      let y = 0;
      for (const { page, vp } of rendered) {
        ctx.save();
        ctx.translate((maxW - vp.width) / 2, y);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        ctx.restore();
        y += Math.ceil(vp.height) + 16;
      }
      setDims({ w: maxW, h: totalH });
    }

    (doc.type === 'pdf' ? renderPdf() : renderImage())
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Dokument konnte nicht geladen werden.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url, doc.type]);

  useEffect(() => {
    if (!dims) return;
    const canvas = annoRef.current;
    if (!canvas) return;
    canvas.width = dims.w;
    canvas.height = dims.h;
    const saved = localStorage.getItem(storeKey);
    if (saved) {
      const img = new Image();
      img.onload = () => annoRef.current?.getContext('2d')?.drawImage(img, 0, 0);
      img.src = saved;
    }
  }, [dims, storeKey]);

  function pt(e: React.PointerEvent) {
    const canvas = annoRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
  function down(e: React.PointerEvent) {
    if (!drawMode) return;
    drawing.current = true;
    last.current = pt(e);
  }
  function move(e: React.PointerEvent) {
    if (!drawMode || !drawing.current) return;
    const ctx = annoRef.current!.getContext('2d')!;
    const p = pt(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    try {
      localStorage.setItem(storeKey, annoRef.current!.toDataURL('image/png', 0.7));
    } catch {
      /* Speicher voll */
    }
  }
  function clearAnno() {
    const canvas = annoRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    localStorage.removeItem(storeKey);
  }

  return (
    <div className={styles.root}>
      {loading && (
        <div className={styles.center}>
          <Spinner />
          <span>Dokument wird geladen…</span>
        </div>
      )}
      {error && <div className={styles.center}>⚠️ {error}</div>}

      <TransformWrapper
        disabled={drawMode}
        minScale={0.3}
        maxScale={8}
        centerOnInit
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.08 }}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}
        >
          <div className={styles.docWrap} style={{ visibility: loading ? 'hidden' : 'visible' }}>
            <canvas ref={contentRef} className={styles.contentCanvas} />
            <canvas
              ref={annoRef}
              className={styles.annoCanvas}
              style={{ pointerEvents: drawMode ? 'all' : 'none', cursor: drawMode ? 'crosshair' : 'default' }}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerLeave={up}
            />
          </div>
        </TransformComponent>
      </TransformWrapper>

      {!loading && !error && (
        <div className={styles.tools}>
          <button
            className={`${styles.toolBtn}${drawMode ? ' ' + styles.on : ''}`}
            onClick={() => setDrawMode((d) => !d)}
            title="Anmerken"
          >
            🖍️
          </button>
          {drawMode && (
            <>
              {DRAW_COLORS.slice(0, 4).map((c) => (
                <div
                  key={c}
                  className={`${styles.color}${color === c ? ' ' + styles.on : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <button className={styles.toolBtn} onClick={clearAnno} title="Löschen">
                ✕
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
