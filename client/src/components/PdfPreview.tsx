import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SetlistSong } from '@shared/types/index';
import { generateChordPdf } from '../utils/chordPdf';
import { parseMetadata } from '../utils/chordpro';
import styles from './PdfPreview.module.scss';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfPreviewProps {
  title: string;
  text: string;
  semitones: number;
}

const MAX_PAGES = 8; // Sicherheitsdeckel – mehr Seiten hat kein Lied

/** Zeigt die „wie gedruckt"-Version des Lieds: erzeugt aus dem ChordPro-Text dieselbe PDF wie die
 *  Bühnen-/Druck-Ansicht und rendert ALLE Seiten untereinander (auf die Panel-Breite eingepasst,
 *  Retina-scharf). Entkoppelt (debounced), damit das Tippen flüssig bleibt; passt sich bei
 *  Größenänderung des Panels automatisch neu ein. */
export function PdfPreview({ title, text, semitones }: PdfPreviewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Erhöht sich bei Panel-Resize → Seiten neu einpassen (sonst bleibt eine beim ersten,
  // evtl. noch winzigen Layout gerenderte Mini-Vorschau stehen).
  const [fitTick, setFitTick] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => setFitTick((x) => x + 1), 150);
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      if (t) clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => void render(), 350);

    async function render() {
      const meta = parseMetadata(text);
      const song = {
        id: 0,
        arrangementId: 0,
        title: meta.title || title,
        author: meta.artist || '',
        originalKey: meta.key || '',
        targetKey: meta.key || '',
        bpm: meta.tempo ? Number(meta.tempo) || null : null,
        timeSig: meta.time || '',
        chordpro: text,
        versions: [],
        documents: [],
      } as unknown as SetlistSong;

      let bytes: ArrayBuffer;
      try {
        bytes = generateChordPdf(song, { semitones, fontPt: 11, cols: 1 }).output('arraybuffer');
      } catch {
        return; // ungültiger Zwischenstand beim Tippen – nächster Lauf rendert neu
      }
      try {
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        const wrap = wrapRef.current;
        if (!wrap) return;
        const width = Math.max(120, wrap.clientWidth - 24);
        const dpr = Math.min(3, window.devicePixelRatio || 1); // Retina-scharf, gedeckelt
        const canvases: HTMLCanvasElement[] = [];
        const n = Math.min(pdf.numPages, MAX_PAGES);
        for (let i = 1; i <= n; i++) {
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          const vp = page.getViewport({ scale: scale * dpr });
          const canvas = document.createElement('canvas');
          canvas.className = styles.canvas;
          canvas.width = Math.ceil(vp.width);
          canvas.height = Math.ceil(vp.height);
          canvas.style.width = `${Math.round(vp.width / dpr)}px`;
          canvas.style.height = `${Math.round(vp.height / dpr)}px`;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          if (cancelled) return;
          canvases.push(canvas);
        }
        // Erst nach vollständigem Rendern austauschen → kein Aufblitzen einer leeren Vorschau.
        wrap.replaceChildren(...canvases);
      } catch {
        /* Render-Fehler ignorieren */
      }
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [title, text, semitones, fitTick]);

  return <div ref={wrapRef} className={styles.wrap} />;
}
