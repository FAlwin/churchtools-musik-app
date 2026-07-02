import { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SetlistPageOwner } from '../utils/chordPdf';
import type { DrawTool } from '../types/index';
import { PageDeck } from './PageDeck';

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
  syncTick?: number;
  onZoomedChange?: (zoomed: boolean) => void;
  resetZoomSignal?: number;
}

/**
 * Durchgehender Seitenstrom über den ganzen Ablauf (ChordPro-Charts der Setlist). Reines Laden der
 * erzeugten PDF – die gesamte Darstellung/Interaktion (2-up im Querformat, Zoom, Anmerkungen,
 * aktive Seite) übernimmt {@link PageDeck}.
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
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      if (!cancelled) setPages(canvases);
    })()
      .then(() => !cancelled && setLoading(false))
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

  // Anmerkungs-Schlüssel pro Lied-Seite (überdauert das Neu-Erzeugen der PDF, da an Lied+Version hängt).
  const drawKeyFor = (page: number): string | null => {
    const o = owners[page];
    return o ? `worship_docdraw_song${o.songId}_v${o.versionKey}_${o.localPage}` : null;
  };
  const zoomKeyBaseFor = (page: number): string => {
    const o = owners[page];
    return o ? `worship_doczoom_song${o.songId}_v${o.versionKey}_${o.localPage}` : `worship_doczoom_p${page}`;
  };

  // Seiten-Hinweis nur bei MEHRSEITIGEN Liedern – zeigt „Lied noch nicht zu Ende". Einseitig: Pfeile reichen.
  const pageLabel = (activePg: number, pageIdx: number): string | null => {
    const cur = owners[activePg] ?? owners[pageIdx];
    if (!cur) return null;
    const songPages = owners.filter((o) => o.songIdx === cur.songIdx).length;
    if (songPages <= 1) return null;
    return `Seite ${cur.localPage + 1} / ${songPages}`;
  };

  return (
    <PageDeck
      pages={pages}
      loading={loading}
      error={error}
      loadingLabel="Lieder werden vorbereitet…"
      drawKeyFor={drawKeyFor}
      zoomKeyBaseFor={zoomKeyBaseFor}
      pageLabel={pageLabel}
      pageIndex={pageIndex}
      onPageIndex={onPageIndex}
      activePage={activePage}
      onActivePage={onActivePage}
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
