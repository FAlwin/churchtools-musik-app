import { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SongDocument } from '@shared/types/index';
import type { DrawTool } from '../types/index';
import { PageDeck } from './PageDeck';

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
  setDrawColor: (c: string) => void;
  drawTool: DrawTool;
  setDrawTool: (t: DrawTool) => void;
  drawColors: string[];
  syncTick?: number;
  onZoomedChange?: (zoomed: boolean) => void;
  resetZoomSignal?: number;
  /** Über die erste Seite hinaus blättern → voriges Lied. */
  onPrev: () => void;
  /** Über die letzte Seite hinaus blättern → nächstes Lied. */
  onNext: () => void;
}

/**
 * Anzeige eines hochgeladenen Dokuments (PDF/Bild) bzw. einer erzeugten PDF. Reines Laden der
 * Seiten – Darstellung/Interaktion (2-up im Querformat wie die ChordPro-Charts, Zoom, Anmerkungen,
 * aktive Seite) übernimmt {@link PageDeck}. Bilder haben genau eine Seite → immer einspaltig.
 */
export function DocumentView({
  songId,
  doc,
  pdfData,
  storeId,
  drawMode,
  drawColor,
  setDrawColor,
  drawTool,
  setDrawTool,
  drawColors,
  syncTick = 0,
  onZoomedChange,
  resetZoomSignal = 0,
  onPrev,
  onNext,
}: DocumentViewProps) {
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [activePage, setActivePage] = useState(0);

  const url = doc ? `/api/songs/${songId}/files/${doc.fileId}` : '';
  // Schlüssel-Basis: erzeugte PDF → pro Lied (storeId), sonst pro Datei. Identisch zum früheren
  // DocumentView-Schema → bestehende Anmerkungen (als PNG in localStorage) laden weiterhin.
  const keyBase = pdfData ? (storeId ?? `song${songId}`) : `${doc?.fileId ?? 'none'}`;

  // Dokument laden → jede Seite in eine eigene (offscreen) Leinwand rendern
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPages([]);
    setPageIndex(0);
    setActivePage(0);

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
        if (!cancelled) setPages(canvases);
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
        if (!cancelled) setPages([c]);
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
        if (!cancelled) setPages(canvases);
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

  const drawKeyFor = (page: number): string => `worship_docdraw_${keyBase}_${page}`;
  const zoomKeyBaseFor = (page: number): string => `worship_doczoom_${keyBase}_${page}`;
  const pageLabel = (active: number, _pageIdx: number, count: number): string | null =>
    count > 1 ? `Seite ${active + 1} / ${count}` : null;

  return (
    <PageDeck
      pages={pages}
      loading={loading}
      error={error}
      loadingLabel="Dokument wird geladen…"
      drawKeyFor={drawKeyFor}
      zoomKeyBaseFor={zoomKeyBaseFor}
      pageLabel={pageLabel}
      onBadgeClick={() => (pageIndex < pages.length - 1 ? setPageIndex(pageIndex + 1) : onNext())}
      onBeforeFirst={onPrev}
      onAfterLast={onNext}
      pageIndex={pageIndex}
      onPageIndex={setPageIndex}
      activePage={activePage}
      onActivePage={setActivePage}
      drawMode={drawMode}
      drawColor={drawColor}
      setDrawColor={setDrawColor}
      drawTool={drawTool}
      setDrawTool={setDrawTool}
      drawColors={drawColors}
      syncTick={syncTick}
      onZoomedChange={onZoomedChange}
      resetZoomSignal={resetZoomSignal}
    />
  );
}
