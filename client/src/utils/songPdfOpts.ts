import type { SetlistSong } from '@shared/types/index';
import { getSemitoneOffset } from './transpose';
import type { ChordPdfOptions } from './chordPdf';
import { lsVersion, selectedVersionKey } from './songVersions';

/** Abschnitts-Transponierung einer Lied-Version aus dem Speicher lesen (wie in ChordChart). */
function loadSecShift(songId: number, versionKey: string): Record<number, number> {
  try {
    const raw = lsVersion('secshift', songId, versionKey);
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

function int(value: string | null, def: number): number {
  const n = value ? parseInt(value, 10) : NaN;
  return Number.isNaN(n) ? def : n;
}

/**
 * Baut die PDF-Optionen eines Lieds aus den gespeicherten Pro-Version-Einstellungen (Tonart, Kapo,
 * Schrift, Spalten, Nur-Text, Abschnitts-Transponierung). So sieht der Export EXAKT so aus wie die
 * Anzeige in der App – inklusive Logo/Tonart im Kopf. `versionKey` standardmäßig die gewählte Version.
 */
export function loadSongPdfOpts(
  song: SetlistSong,
  logo?: HTMLImageElement | string | null,
  versionKey: string = selectedVersionKey(song),
): ChordPdfOptions {
  const key = lsVersion('key', song.id, versionKey) || song.targetKey || song.originalKey || '';
  const capo = int(lsVersion('capo', song.id, versionKey), 0);
  const fs = int(lsVersion('fs', song.id, versionKey), 20);
  const cols = (int(lsVersion('cols', song.id, versionKey), 1) === 2 ? 2 : 1) as 1 | 2;
  const lyricsOnly = lsVersion('lyrics', song.id, versionKey) === '1';
  const secShift = loadSecShift(song.id, versionKey);
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
