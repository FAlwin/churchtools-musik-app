import { useEffect, useRef } from 'react';
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

/** Zeigt die „wie gedruckt"-Version des Lieds: erzeugt aus dem ChordPro-Text dieselbe PDF wie die
 *  Bühnen-/Druck-Ansicht und rendert die erste Seite. Entkoppelt (debounced), damit das Tippen
 *  flüssig bleibt. */
export function PdfPreview({ title, text, semitones }: PdfPreviewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        const page = await pdf.getPage(1);
        const wrap = wrapRef.current;
        const canvas = canvasRef.current;
        if (!wrap || !canvas || cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const scale = Math.max(0.2, (wrap.clientWidth - 16) / base.width);
        const vp = page.getViewport({ scale });
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
      } catch {
        /* Render-Fehler ignorieren */
      }
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [title, text, semitones]);

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
