import type { SetlistSong } from '@shared/types/index';
import { ZAEHLWEISEN } from './metronome';
import {
  lsVersion,
  lsSong,
  selectedVersionKey,
  readVersioned,
  fromLocalStorage,
  type SettingSource,
} from './songVersions';

/** Einstellungen pro Lied (Tonart, Kapo, Abschnitts-Transponierung, Schrift, Spalten, Anzeige). */
export interface SongSettings {
  key: string | null; // null = Standard (targetKey)
  capo: number;
  cols: 1 | 2;
  fontSize: number;
  lyricsOnly: boolean;
  secShift: Record<number, number>;
  /**
   * Zählweise: Wie viele Grundschläge werden zu einem gezählten Schlag zusammengefasst? (#145)
   * `null` = aus der Taktart abgeleitet (6/8 & Co. in Dreiergruppen, sonst einzeln).
   *
   * Persönlich wie Tonart und Kapo, nicht wie Spalten und Schrift – deshalb wird sie beim
   * Übernehmen fremder Notizen bewusst NICHT mitgenommen (siehe `useTeamNotesImport`): Wie jemand
   * ein Stück zählt, ist seine Sache und nicht Teil der geteilten Ansicht.
   */
  zaehlweise: number | null;
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
  zaehlweise: null,
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

/**
 * Liest die per-Abschnitt-Transponierung aus localStorage; ignoriert ungültige/0-Werte.
 *
 * Nutzt bewusst `parseSecShift` – die Parse-Schleife stand hier bis #247 ein zweites Mal wortgleich.
 */
export function loadSecShift(songId: number, versionKey: string): Record<number, number> {
  return parseSecShift(lsVersion('secshift', songId, versionKey));
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

/**
 * Die Einstellungen einer Lied-Version aus einer beliebigen Quelle bauen (#247).
 *
 * **Es darf nur diese eine Umrechnung geben.** Vorher baute `settingsForLevel` sie daneben selbst –
 * ohne `intOr` (also mit `NaN`-Gefahr im Kapo), mit hartkodierter Standard-Schriftgröße und ohne die
 * Schlüssel-Rückfälle aus `songVersions`. Wer die Notizen eines Kollegen ansah, bekam dadurch
 * Standardwerte statt dessen Ansicht.
 */
function buildSettings(
  src: SettingSource,
  songId: number,
  versionKey: string,
): Omit<SongSettings, 'viewSource' | 'lyricsOnly'> & { lyricsOnly: boolean } {
  const get = (base: string): string | null => readVersioned(src, base, songId, versionKey);
  return {
    key: get('key') || null,
    capo: intOr(get('capo'), DEFAULT_SETTINGS.capo),
    cols: intOr(get('cols'), DEFAULT_SETTINGS.cols) === 2 ? 2 : 1,
    fontSize: intOr(get('fs'), DEFAULT_SETTINGS.fontSize),
    lyricsOnly: get('lyrics') === '1',
    secShift: parseSecShift(get('secshift')),
    // 0 gibt es nicht – ein unbekannter oder kaputter Wert heißt „aus der Taktart ableiten".
    zaehlweise: ZAEHLWEISEN.includes(intOr(get('zaehl'), 0) as 1 | 2 | 3)
      ? intOr(get('zaehl'), 0)
      : null,
    versionKey,
  };
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
  return { ...buildSettings(fromLocalStorage, song.id, versionKey), viewSource };
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
 *
 * Die Darstellungsart kommt hier von außen (die angesehene Ebene bestimmt sie), nicht aus der Tabelle.
 */
export function settingsForLevel(
  song: SetlistSong,
  map: Record<string, string>,
  versionKey: string,
  lyricsOnly: boolean,
): SongSettings {
  const fromMap: SettingSource = (key) => map[key] ?? null;
  return {
    ...buildSettings(fromMap, song.id, versionKey),
    lyricsOnly,
    viewSource: 'chords',
  };
}
