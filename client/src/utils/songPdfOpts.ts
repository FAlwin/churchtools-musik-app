import type { SetlistSong } from '@shared/types/index';
import { getSemitoneOffset } from './transpose';
import type { ChordPdfOptions } from './chordPdf';

/** Abschnitts-Transponierung eines Lieds aus dem Speicher lesen (wie in ChordChart). */
function loadSecShift(songId: number): Record<number, number> {
  try {
    const raw = localStorage.getItem(`worship_secshift_${songId}`);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, number>;
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      const n = Number(k);
      if (Number.isInteger(n) && typeof v === 'number' && v !== 0) out[n] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function int(key: string, def: number): number {
  const v = localStorage.getItem(key);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isNaN(n) ? def : n;
}

/**
 * Baut die PDF-Optionen eines Lieds aus den gespeicherten Pro-Lied-Einstellungen (Tonart, Kapo,
 * Schrift, Spalten, Nur-Text, Abschnitts-Transponierung). So sieht der Export EXAKT so aus wie die
 * Anzeige in der App – inklusive Logo/Tonart im Kopf.
 */
export function loadSongPdfOpts(song: SetlistSong, logo?: HTMLImageElement | string | null): ChordPdfOptions {
  const key = localStorage.getItem(`worship_key_${song.id}`) || song.targetKey || song.originalKey || '';
  const capo = int(`worship_capo_${song.id}`, 0);
  const fs = int(`worship_fs_${song.id}`, 20);
  const cols = (int(`worship_cols_${song.id}`, 1) === 2 ? 2 : 1) as 1 | 2;
  const lyricsOnly = localStorage.getItem(`worship_lyrics_${song.id}`) === '1';
  const secShift = loadSecShift(song.id);
  return {
    semitones: getSemitoneOffset(song.originalKey, key) - capo,
    cols,
    fontPt: Math.max(8, Math.round(fs * 0.6)),
    lyricsOnly,
    sectionSemitones: secShift,
    displayKey: key,
    logo,
  };
}

/** Lädt das App-Logo (für die PDF-Kopfzeile). Liefert ein Promise auf das Bild (oder null). */
export function loadAppLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/logo.png';
  });
}
