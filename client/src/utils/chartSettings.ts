import type { SetlistSong } from '@shared/types/index';
import { lsVersion, lsSong, selectedVersionKey } from './songVersions';

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

/** Grenzen der Schriftgröße im Aussehen-Menü (Punkt = Bildschirm-Pixel der Anzeige). */
export const FONT_MIN = 12;
export const FONT_MAX = 40;
const FONT_STEP = 2;

/**
 * Nächste Schriftgröße beim Tippen auf „A−"/„A+" (#198).
 *
 * Lag als doppelte `Math.max`/`Math.min`-Rechnung im JSX des Aussehen-Menüs. Als reine Funktion ist
 * das Wichtige prüfbar: An den Grenzen darf sie **stehen bleiben** und nicht darüber hinauslaufen –
 * eine 8 oder eine 60 würde das Chart auf dem Notenständer unlesbar bzw. unbrauchbar machen.
 */
export function stepFontSize(current: number, direction: 1 | -1): number {
  const next = current + direction * FONT_STEP;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, next));
}

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

/**
 * Ganzzahl aus dem Speicher, mit Rückfall bei Fehlen **und bei Unsinn**.
 *
 * `parseInt('abc')` ergibt `NaN`; ein NaN im Kapo hätte den Halbton-Versatz der PDF zu `NaN` gemacht
 * und damit das ganze Blatt zerstört. Die frühere zweite Fassung in `songPdfOpts.ts` fing das ab,
 * `loadSettings` – also die ANZEIGE – nicht. Beim Zusammenführen (#239) gilt die robustere Regel.
 */
function intOr(value: string | null, fallback: number): number {
  const n = value ? parseInt(value, 10) : NaN;
  return Number.isNaN(n) ? fallback : n;
}

/** Baut die SongSettings eines Lieds aus localStorage (Defaults, wenn nichts gespeichert ist). */
export function loadSettings(
  song: SetlistSong,
  versionKey: string = selectedVersionKey(song),
): SongSettings {
  // viewSource (Dokument vs. Akkorde) gilt pro Lied, nicht pro Version.
  const savedView = lsSong('view', song.id);
  const savedId = savedView ? Number(savedView) : NaN;
  const viewSource =
    savedView && !Number.isNaN(savedId) && song.documents.some((d) => d.fileId === savedId)
      ? savedId
      : 'chords';
  return {
    key: lsVersion('key', song.id, versionKey) || null,
    capo: intOr(lsVersion('capo', song.id, versionKey), 0),
    cols: intOr(lsVersion('cols', song.id, versionKey), 1) === 2 ? 2 : 1,
    fontSize: intOr(lsVersion('fs', song.id, versionKey), DEFAULT_SETTINGS.fontSize),
    lyricsOnly: lsVersion('lyrics', song.id, versionKey) === '1',
    secShift: loadSecShift(song.id, versionKey),
    versionKey,
    viewSource,
  };
}

/** secShift-Rohwert (JSON) sicher parsen; ignoriert Ungültiges/0-Werte. */
function parseSecShift(raw: string | null): Record<number, number> {
  try {
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

/**
 * SongSettings für eine KONKRETE Ebene (Version + Darstellungsart) aus einer gelieferten
 * Schlüssel-Tabelle – fürs Ansehen einer ausgewählten Ebene einer teilenden Person
 * (nicht zwingend ihrer aktuell gewählten).
 */
export function settingsForLevel(
  song: SetlistSong,
  map: Record<string, string>,
  versionKey: string,
  lyricsOnly: boolean,
): SongSettings {
  const get = (base: string): string | null =>
    map[`worship_${base}_${song.id}_${versionKey}`] ?? null;
  return {
    key: get('key') || null,
    capo: parseInt(get('capo') || '0', 10),
    cols: parseInt(get('cols') || '1', 10) === 2 ? 2 : 1,
    fontSize: parseInt(get('fs') || '20', 10),
    lyricsOnly,
    secShift: parseSecShift(get('secshift')),
    versionKey,
    viewSource: 'chords',
  };
}
