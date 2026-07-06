import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Worker inline im Bundle (../pdfSetup) → Charts rendern auch offline (#32).
import '../pdfSetup';
import type { SetlistSong } from '@shared/types/index';
import type { SetlistPageOwner } from '../utils/chordPdf';
import type { SongSettings } from '../utils/chartSettings';

/**
 * Besitzer einer Seite im DURCHGEHENDEN Setlist-Strom – Akkorde ODER hochgeladenes Dokument.
 * Erweitert {@link SetlistPageOwner} um die Quelle, damit Anmerkungs-/Zoom-Schlüssel und der
 * Seiten-Hinweis pro Seite passend gebildet werden.
 */
export interface StreamOwner {
  songIdx: number;
  songId: number;
  localPage: number;
  kind: 'chord' | 'doc';
  /** Chord: Versions-Schlüssel für versionsbezogene Anmerkungen. Doc: 'doc'. */
  versionKey: string;
  /** Nur bei kind==='doc': Datei-ID des hochgeladenen Dokuments. */
  fileId?: number;
  docType?: 'pdf' | 'image';
}

interface Args {
  /** Kombinierte ChordPro-PDF (alle Lieder) – Quelle der Akkord-Seiten. */
  chordPdfData: ArrayBuffer | null;
  /** Seiten-Besitzer der ChordPro-PDF (ein Eintrag je Akkord-Seite, in derselben Reihenfolge). */
  chordOwners: SetlistPageOwner[];
  songs: SetlistSong[];
  settings: Record<number, SongSettings>;
}

const RENDER_SCALE = 2;

async function renderPdfToCanvases(source: { data: ArrayBuffer } | { url: string }): Promise<HTMLCanvasElement[]> {
  // Dokumente IMMER komplett per fetch laden statt pdf.js selbst streamen zu lassen: pdf.js nutzt
  // sonst Range-Requests (Teilstücke), die den Service-Worker-Datei-Cache verfehlen/verwirren –
  // offline hing der Aufbau dadurch ~10 s, bis der Fallback griff (#32). Ein normaler GET trifft
  // den CacheFirst-Eintrag sauber; die Lied-PDFs sind klein, Volllast auch online unkritisch.
  let data: ArrayBuffer;
  if ('data' in source) {
    data = source.data;
  } else {
    const res = await fetch(source.url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Dokument konnte nicht geladen werden (${res.status})`);
    data = await res.arrayBuffer();
  }
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const out: HTMLCanvasElement[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: RENDER_SCALE });
    const c = document.createElement('canvas');
    c.width = Math.ceil(vp.width);
    c.height = Math.ceil(vp.height);
    await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
    out.push(c);
  }
  return out;
}

async function renderImageToCanvas(url: string): Promise<HTMLCanvasElement> {
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
  return c;
}

/**
 * Baut den durchgehenden Setlist-Strom als EINE geordnete Seiten-Liste (Leinwände) + Besitzer.
 * Für jedes Lied steuert – je nach `viewSource` – entweder die ChordPro-Seite(n) ODER das gewählte
 * hochgeladene Dokument (PDF/Bild) bei. So lässt sich mit einer einzigen 2-up-Ansicht nahtlos über
 * den ganzen Ablauf wischen. Dokument-Seiten werden je Datei-ID zwischengespeichert, damit ein
 * Neuaufbau der Akkord-Seiten (z. B. beim Transponieren) sie nicht erneut laden muss.
 */
export function useSetlistPages({ chordPdfData, chordOwners, songs, settings }: Args) {
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [owners, setOwners] = useState<StreamOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const docCache = useRef<Map<number, HTMLCanvasElement[]>>(new Map());
  const firstDone = useRef(false);

  // Neu bauen, wenn sich die Akkord-PDF (Transponieren/Text/Reihenfolge) oder die Quellwahl
  // (Akkorde ↔ Dokument) je Lied ändert.
  const viewSig = songs.map((s) => `${s.id}:${settings[s.id]?.viewSource ?? 'chords'}`).join(',');

  useEffect(() => {
    let cancelled = false;
    if (!chordPdfData || songs.length === 0) {
      setPages([]);
      setOwners([]);
      setLoading(false);
      return;
    }
    if (!firstDone.current) setLoading(true);
    setError(null);

    (async () => {
      // 1) Akkord-Seiten der kombinierten PDF rendern und je Lied gruppieren (Reihenfolge = localPage).
      const chordCanvases = await renderPdfToCanvases({ data: chordPdfData.slice(0) });
      if (cancelled) return;
      const chordBySong = new Map<number, { canvas: HTMLCanvasElement; versionKey: string }[]>();
      chordOwners.forEach((o, i) => {
        const c = chordCanvases[i];
        if (!c) return;
        const list = chordBySong.get(o.songIdx) ?? [];
        list.push({ canvas: c, versionKey: o.versionKey });
        chordBySong.set(o.songIdx, list);
      });

      // 2) Für Lieder mit gewähltem Dokument dessen Seiten rendern (je Datei-ID gecacht).
      for (let si = 0; si < songs.length; si++) {
        const song = songs[si];
        const vs = settings[song.id]?.viewSource ?? 'chords';
        if (vs === 'chords') continue;
        const docMatch = song.documents.find((d) => d.fileId === vs);
        if (!docMatch || docCache.current.has(docMatch.fileId)) continue;
        const url = `/api/songs/${song.id}/files/${docMatch.fileId}`;
        try {
          const canvases = docMatch.type === 'image' ? [await renderImageToCanvas(url)] : await renderPdfToCanvases({ url });
          if (cancelled) return;
          docCache.current.set(docMatch.fileId, canvases);
        } catch {
          // Fehlgeschlagenes Dokument → leer lassen; das Lied fällt unten auf seine Akkord-Seiten zurück.
        }
      }

      // 3) In Setlist-Reihenfolge zusammensetzen: je Lied Dokument- ODER Akkord-Seiten.
      const nextPages: HTMLCanvasElement[] = [];
      const nextOwners: StreamOwner[] = [];
      songs.forEach((song, si) => {
        const vs = settings[song.id]?.viewSource ?? 'chords';
        const docMatch = vs !== 'chords' ? song.documents.find((d) => d.fileId === vs) : undefined;
        const docCanvases = docMatch ? docCache.current.get(docMatch.fileId) : undefined;
        if (docMatch && docCanvases && docCanvases.length > 0) {
          docCanvases.forEach((canvas, lp) => {
            nextPages.push(canvas);
            nextOwners.push({
              songIdx: si,
              songId: song.id,
              localPage: lp,
              kind: 'doc',
              versionKey: 'doc',
              fileId: docMatch.fileId,
              docType: docMatch.type,
            });
          });
        } else {
          // Akkord-Seiten (auch Fallback, falls ein gewähltes Dokument nicht geladen werden konnte).
          const chords = chordBySong.get(si) ?? [];
          chords.forEach(({ canvas, versionKey }, lp) => {
            nextPages.push(canvas);
            nextOwners.push({ songIdx: si, songId: song.id, localPage: lp, kind: 'chord', versionKey });
          });
        }
      });

      if (cancelled) return;
      setPages(nextPages);
      setOwners(nextOwners);
      firstDone.current = true;
      setLoading(false);
    })().catch((e) => {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : 'Ablauf konnte nicht vorbereitet werden.');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chordPdfData, viewSig]);

  return { pages, owners, loading, error };
}
