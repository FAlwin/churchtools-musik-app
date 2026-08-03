import type { SetlistSong } from '@shared/types/index';
import type { SongSettings } from './chartSettings';

/** Wem gehört eine Seite im durchgehenden Strom (Lied + Seite darin, Akkorde oder Dokument). */
export interface StreamOwner {
  songIdx: number;
  songId: number;
  localPage: number;
  kind: 'chord' | 'doc';
  versionKey: string;
  fileId?: number;
  docType?: 'pdf' | 'image';
}

/** Eine gerenderte Akkord-Seite mit ihrer Version (Reihenfolge = Seite im Lied). */
export interface ChordPage<T> {
  canvas: T;
  versionKey: string;
}

interface ComposeInput<T> {
  songs: SetlistSong[];
  settings: Record<number, SongSettings>;
  /** Akkord-Seiten je Lied-Index. */
  chordBySong: Map<number, ChordPage<T>[]>;
  /** Bereits gerenderte Dokument-Seiten je Datei-ID. */
  docPages: Map<number, T[]>;
}

/**
 * Setzt den durchgehenden Seitenstrom zusammen (#251 – vorher inline in einem 100-Zeilen-Effekt).
 *
 * Je Lied gilt **entweder** sein gewähltes Dokument **oder** seine Akkord-Seiten. Rein und ohne
 * Rendering, damit die Reihenfolge und die Besitzer-Zuordnung prüfbar sind: Stimmt `owners` nicht,
 * landen Anmerkungen auf der falschen Seite – der Fehler, der im Gottesdienst am meisten wehtut.
 *
 * Konnte ein gewähltes Dokument nicht geladen werden, fällt das Lied auf seine Akkorde zurück. Das
 * ist gewollt (lieber Akkorde als eine leere Seite), muss aber **sichtbar** sein – dafür meldet
 * `fellBackToChords` die betroffenen Lieder, statt es stillschweigend zu tun.
 */
export function composeStream<T>({ songs, settings, chordBySong, docPages }: ComposeInput<T>): {
  pages: T[];
  owners: StreamOwner[];
  fellBackToChords: number[];
} {
  const pages: T[] = [];
  const owners: StreamOwner[] = [];
  const fellBackToChords: number[] = [];

  songs.forEach((song, si) => {
    const viewSource = settings[song.id]?.viewSource ?? 'chords';
    const doc =
      viewSource !== 'chords' ? song.documents.find((d) => d.fileId === viewSource) : undefined;
    const docCanvases = doc ? docPages.get(doc.fileId) : undefined;

    if (doc && docCanvases && docCanvases.length > 0) {
      docCanvases.forEach((canvas, localPage) => {
        pages.push(canvas);
        owners.push({
          songIdx: si,
          songId: song.id,
          localPage,
          kind: 'doc',
          versionKey: 'doc',
          fileId: doc.fileId,
          docType: doc.type,
        });
      });
      return;
    }

    // Ein gewähltes, aber nicht ladbares Dokument → Rückfall auf die Akkorde, und das wird gemeldet.
    if (doc) fellBackToChords.push(song.id);

    for (const [localPage, { canvas, versionKey }] of (chordBySong.get(si) ?? []).entries()) {
      pages.push(canvas);
      owners.push({ songIdx: si, songId: song.id, localPage, kind: 'chord', versionKey });
    }
  });

  return { pages, owners, fellBackToChords };
}

/**
 * Welche Dokument-Seiten dürfen im Vorrat bleiben? (#251)
 *
 * Der Vorrat wuchs unbegrenzt: Jedes einmal angesehene Dokument blieb bis zum Neuladen der Seite im
 * Speicher – bei einem Ablauf mit vielen Noten-PDFs summiert sich das. Behalten wird nur, was gerade
 * gewählt ist.
 */
export function docPagesToKeep(
  songs: SetlistSong[],
  settings: Record<number, SongSettings>,
): Set<number> {
  const keep = new Set<number>();
  for (const song of songs) {
    const viewSource = settings[song.id]?.viewSource ?? 'chords';
    if (viewSource !== 'chords') keep.add(viewSource);
  }
  return keep;
}
