import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Worker inline im Bundle (../pdfSetup) → Charts rendern auch offline (#32).
import '../pdfSetup';
import type { SetlistSong } from '@shared/types/index';
import type { SetlistPageOwner } from '../utils/chordPdf';
import { fetchFileBytes } from '../services/fileDownload';
import type { SongSettings } from '../utils/chartSettings';
import { composeStream, docPagesToKeep, type StreamOwner } from '../utils/streamCompose';
import { useLatestRef } from './useLatestRef';

interface Args {
  /** Kombinierte ChordPro-PDF (alle Lieder) – Quelle der Akkord-Seiten. */
  chordPdfData: ArrayBuffer | null;
  /** Seiten-Besitzer der ChordPro-PDF (ein Eintrag je Akkord-Seite, in derselben Reihenfolge). */
  chordOwners: SetlistPageOwner[];
  songs: SetlistSong[];
  settings: Record<number, SongSettings>;
  /**
   * Ein gewähltes Dokument konnte nicht geladen werden (#251). Ohne diese Meldung fiel das Lied
   * STILL auf seine Akkorde zurück – der Nutzer hatte „Dokument anzeigen" gewählt und bekam ohne ein
   * Wort Akkorde.
   */
  onDocError?: (songTitles: string[]) => void;
}

const RENDER_SCALE = 2;

async function renderPdfToCanvases(
  source: { data: ArrayBuffer } | { url: string },
): Promise<HTMLCanvasElement[]> {
  // Dokumente IMMER komplett laden statt pdf.js selbst streamen zu lassen – Begründung in
  // `services/fileDownload.ts` (#32).
  const data = 'data' in source ? source.data : await fetchFileBytes(source.url);
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
export function useSetlistPages({ chordPdfData, chordOwners, songs, settings, onDocError }: Args) {
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [owners, setOwners] = useState<StreamOwner[]>([]);
  // Einstellungs-Schnappschuss, mit dem die AKTUELL SICHTBAREN Seiten gebaut wurden. Anmerkungs-
  // Schlüssel (v. a. die Darstellungsart „Nur Text") müssen DARAN hängen, nicht an den Live-
  // Einstellungen – sonst wechseln die Notiz-Ebenen schon während des asynchronen Neuaufbaus
  // (Notizen „erscheinen vor dem Text", Stift schreibt in die falsche Ebene).
  const [publishedSettings, setPublishedSettings] = useState<Record<number, SongSettings>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const docCache = useRef<Map<number, HTMLCanvasElement[]>>(new Map());
  const firstDone = useRef(false);
  // Die Eingaben, die sich JEDES Render neu ergeben, über Refs lesen statt als Abhängigkeit führen
  // (Muster aus #193). Dadurch braucht der Effekt unten kein abgeschaltetes `exhaustive-deps` mehr.
  const liveRef = useLatestRef({ chordOwners, songs, settings, onDocError });

  // Neu bauen, wenn sich die Akkord-PDF (Transponieren/Text/Reihenfolge) oder die Quellwahl
  // (Akkorde ↔ Dokument) je Lied ändert.
  const viewSig = songs.map((s) => `${s.id}:${settings[s.id]?.viewSource ?? 'chords'}`).join(',');

  useEffect(() => {
    let cancelled = false;
    if (!chordPdfData || liveRef.current.songs.length === 0) {
      setPages([]);
      setOwners([]);
      setPublishedSettings({});
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
      liveRef.current.chordOwners.forEach((o, i) => {
        const c = chordCanvases[i];
        if (!c) return;
        const list = chordBySong.get(o.songIdx) ?? [];
        list.push({ canvas: c, versionKey: o.versionKey });
        chordBySong.set(o.songIdx, list);
      });

      // 2) Für Lieder mit gewähltem Dokument dessen Seiten rendern (je Datei-ID gecacht).
      const { songs: curSongs, settings: curSettings } = liveRef.current;
      // Vorrat auf die aktuell gewählten Dokumente eingrenzen (#251) – vorher wuchs er unbegrenzt:
      // jedes einmal angesehene Dokument blieb bis zum Neuladen der Seite im Speicher.
      const keep = docPagesToKeep(curSongs, curSettings);
      for (const fileId of [...docCache.current.keys()]) {
        if (!keep.has(fileId)) docCache.current.delete(fileId);
      }
      for (const song of curSongs) {
        const vs = curSettings[song.id]?.viewSource ?? 'chords';
        if (vs === 'chords') continue;
        const docMatch = song.documents.find((d) => d.fileId === vs);
        if (!docMatch || docCache.current.has(docMatch.fileId)) continue;
        const url = `/api/songs/${song.id}/files/${docMatch.fileId}`;
        try {
          const canvases =
            docMatch.type === 'image'
              ? [await renderImageToCanvas(url)]
              : await renderPdfToCanvases({ url });
          if (cancelled) return;
          docCache.current.set(docMatch.fileId, canvases);
        } catch {
          // Fehlgeschlagen → das Lied fällt unten auf seine Akkorde zurück; gemeldet wird es dort.
        }
      }

      // 3) In Setlist-Reihenfolge zusammensetzen – reine Umformung, deshalb ausgelagert und
      // getestet (#251): Stimmt die Besitzer-Zuordnung nicht, landen Anmerkungen auf falschen Seiten.
      const {
        pages: nextPages,
        owners: nextOwners,
        fellBackToChords,
      } = composeStream({
        songs: curSongs,
        settings: curSettings,
        chordBySong,
        docPages: docCache.current,
      });

      // Ein gewähltes Dokument, das nicht geladen werden konnte, darf nicht STILL zu Akkorden werden.
      if (fellBackToChords.length > 0) {
        const titel = fellBackToChords.map((id) => curSongs.find((x) => x.id === id)?.title ?? '');
        liveRef.current.onDocError?.(titel.filter(Boolean));
      }

      if (cancelled) return;
      setPages(nextPages);
      setOwners(nextOwners);
      // Schnappschuss GEMEINSAM mit den Seiten veröffentlichen (siehe Kommentar am State).
      setPublishedSettings(curSettings);
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
    // `liveRef` ist stabil (useLatestRef); alles Instabile wird daraus gelesen → keine
    // abgeschaltete Prüfung mehr nötig. Die Kopplung ist bewusst: `chordPdfData` entsteht bei
    // JEDER Einstellungsänderung neu (ChordChart baut den Strom dann neu), deshalb genügt es als
    // Auslöser zusammen mit `viewSig`.
  }, [chordPdfData, viewSig, liveRef]);

  return { pages, owners, publishedSettings, loading, error };
}
