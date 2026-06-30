import type { SetlistSong } from '@shared/types/index';
import { lsVersion, selectedVersionKey } from './songVersions';

/** Einstellungen pro Lied (Tonart, Kapo, Abschnitts-Transponierung, Schrift, Spalten, Anzeige). */
export interface SongSettings {
  key: string | null; // null = Standard (targetKey)
  capo: number;
  cols: 1 | 2;
  fontSize: number;
  lyricsOnly: boolean;
  secShift: Record<number, number>;
  /** Schlüssel der gewählten Version ('original' oder Slug) – Einstellungen gelten je Version. */
  versionKey: string;
  viewSource: 'chords' | number; // 'chords' oder fileId eines hochgeladenen Dokuments
}

export const DEFAULT_SETTINGS: SongSettings = {
  key: null,
  capo: 0,
  cols: 1,
  fontSize: 20,
  lyricsOnly: false,
  secShift: {},
  versionKey: 'original',
  viewSource: 'chords',
};

/** Liest die per-Abschnitt-Transponierung aus localStorage; ignoriert ungültige/0-Werte. */
export function loadSecShift(songId: number, versionKey: string): Record<number, number> {
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

/** Baut die SongSettings eines Lieds aus localStorage (Defaults, wenn nichts gespeichert ist). */
export function loadSettings(
  song: SetlistSong,
  versionKey: string = selectedVersionKey(song),
): SongSettings {
  // viewSource (Dokument vs. Akkorde) gilt pro Lied, nicht pro Version.
  const savedView = localStorage.getItem(`worship_view_${song.id}`);
  const savedId = savedView ? Number(savedView) : NaN;
  const viewSource =
    savedView && !Number.isNaN(savedId) && song.documents.some((d) => d.fileId === savedId)
      ? savedId
      : 'chords';
  return {
    key: lsVersion('key', song.id, versionKey) || null,
    capo: parseInt(lsVersion('capo', song.id, versionKey) || '0', 10),
    cols: parseInt(lsVersion('cols', song.id, versionKey) || '1', 10) === 2 ? 2 : 1,
    fontSize: parseInt(lsVersion('fs', song.id, versionKey) || '20', 10),
    lyricsOnly: lsVersion('lyrics', song.id, versionKey) === '1',
    secShift: loadSecShift(song.id, versionKey),
    versionKey,
    viewSource,
  };
}
