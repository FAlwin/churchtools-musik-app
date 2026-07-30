// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { pdfOptionsForSong } from './chartPdfOptions';
import { loadSongPdfOpts } from './songPdfOpts';
import { DEFAULT_SETTINGS, type SongSettings } from './chartSettings';
import type { SetlistSong } from '@shared/types/index';

/**
 * #197: Die Umrechnung Einstellungen → PDF-Optionen lag inline im Render von `ChordChart`. Als
 * reine Funktion ist vor allem die Tonart-Rechnung prüfbar – ein Vorzeichenfehler beim Kapo
 * transponiert das ganze Liederheft falsch, und das fällt erst im Gottesdienst auf.
 */
const song = (over: Partial<SetlistSong> = {}): SetlistSong =>
  ({
    id: 1,
    originalKey: 'C',
    targetKey: 'D',
    chordpro: '[C]Text',
    versions: [],
    documents: [],
    ...over,
  }) as unknown as SetlistSong;

const settings = (over: Partial<SongSettings> = {}): SongSettings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});

describe('pdfOptionsForSong – Tonart und Kapo', () => {
  it('ohne eigene Wahl gilt die Ziel-Tonart aus ChurchTools', () => {
    const o = pdfOptionsForSong(song({ originalKey: 'C', targetKey: 'D' }), settings());
    expect(o.semitones).toBe(2); // C → D
    expect(o.displayKey).toBe('D');
  });

  it('eine selbst gewählte Tonart schlägt die Ziel-Tonart', () => {
    const o = pdfOptionsForSong(song({ originalKey: 'C', targetKey: 'D' }), settings({ key: 'F' }));
    expect(o.semitones).toBe(5); // C → F
    expect(o.displayKey).toBe('F');
  });

  it('Kapo wird ABGEZOGEN (Kapo 2 = zwei Halbtöne tiefer notieren)', () => {
    // Der Kapo hebt die Saiten an; damit es klingend passt, muss die Notation tiefer sein.
    const o = pdfOptionsForSong(song({ originalKey: 'C', targetKey: 'D' }), settings({ capo: 2 }));
    expect(o.semitones).toBe(0);
  });

  it('Kapo und Tonartwahl greifen zusammen', () => {
    const o = pdfOptionsForSong(
      song({ originalKey: 'C', targetKey: 'C' }),
      settings({ key: 'E', capo: 4 }),
    );
    expect(o.semitones).toBe(0); // C→E = +4, Kapo 4 → 0
  });

  it('ohne Transposition bleibt es bei 0', () => {
    const o = pdfOptionsForSong(song({ originalKey: 'G', targetKey: 'G' }), settings());
    expect(o.semitones).toBe(0);
  });
});

describe('pdfOptionsForSong – Darstellung', () => {
  it('rechnet die Bildschirm-Schriftgröße in Punkt um', () => {
    expect(pdfOptionsForSong(song(), settings({ fontSize: 20 })).fontPt).toBe(12); // 20 * 0,6
  });

  it('geht nie unter 8 pt (sonst auf dem Notenständer unlesbar)', () => {
    expect(pdfOptionsForSong(song(), settings({ fontSize: 4 })).fontPt).toBe(8);
  });

  it('reicht Spalten, Nur-Text und Abschnitts-Versatz durch', () => {
    const secShift = { 0: 1, 2: -1 };
    const o = pdfOptionsForSong(song(), settings({ cols: 2, lyricsOnly: true, secShift }));
    expect(o.cols).toBe(2);
    expect(o.lyricsOnly).toBe(true);
    expect(o.sectionSemitones).toEqual(secShift);
  });

  it('nimmt das Logo entgegen und ist ohne Logo zufrieden', () => {
    expect(pdfOptionsForSong(song(), settings(), 'data:image/png;base64,AAA').logo).toBe(
      'data:image/png;base64,AAA',
    );
    expect(pdfOptionsForSong(song(), settings()).logo).toBeNull();
  });
});

/**
 * #239: Es gab DREI Fassungen der PDF-Optionen – `pdfOptionsForSong`, `loadSongPdfOpts` (mit
 * eigenem Speicher-Lesen) und ein Inline-Block in `ChordChart` für „Als PDF teilen", dem der
 * Kapo-Abzug fehlte. Jetzt führt alles hierher. Diese Tests halten fest, dass der Weg über den
 * Speicher (Ablauf-PDF) zum selben Ergebnis kommt wie der direkte.
 */
describe('loadSongPdfOpts – derselbe Weg über den Speicher (#239)', () => {
  const SONG_ID = 42;

  beforeEach(() => localStorage.clear());

  it('liest Tonart und Kapo und zieht den Kapo ab – wie pdfOptionsForSong', () => {
    localStorage.setItem(`worship_key_${SONG_ID}_original`, 'D');
    localStorage.setItem(`worship_capo_${SONG_ID}_original`, '2');
    const s = song({ id: SONG_ID, originalKey: 'C', targetKey: 'C' });

    const ueberSpeicher = loadSongPdfOpts(s);
    const direkt = pdfOptionsForSong(s, settings({ key: 'D', capo: 2 }));
    expect(ueberSpeicher.semitones).toBe(direkt.semitones);
    expect(ueberSpeicher.semitones).toBe(0); // C→D = +2, Kapo 2 → 0
    expect(ueberSpeicher.displayKey).toBe('D');
  });

  it('ohne gespeicherte Werte gilt die Ziel-Tonart aus ChurchTools', () => {
    const o = loadSongPdfOpts(song({ id: SONG_ID, originalKey: 'C', targetKey: 'E' }));
    expect(o.semitones).toBe(4);
    expect(o.displayKey).toBe('E');
  });

  it('fällt ohne Ziel-Tonart auf die Original-Tonart zurück (statt auf nichts)', () => {
    const o = loadSongPdfOpts(song({ id: SONG_ID, originalKey: 'G', targetKey: '' }));
    expect(o.semitones).toBe(0);
    expect(o.displayKey).toBe('G');
  });

  it('Unsinn im Speicher zerstört das Blatt nicht (kein NaN im Versatz)', () => {
    // Ein NaN hier hätte jsPDF ein unbrauchbares Dokument liefern lassen.
    localStorage.setItem(`worship_capo_${SONG_ID}_original`, 'kaputt');
    localStorage.setItem(`worship_fs_${SONG_ID}_original`, 'auch-kaputt');
    const o = loadSongPdfOpts(song({ id: SONG_ID, originalKey: 'C', targetKey: 'C' }));
    expect(Number.isNaN(o.semitones)).toBe(false);
    expect(o.semitones).toBe(0);
    expect(o.fontPt).toBe(12); // 20 * 0,6 = 12 (Rückfall auf die Standardgröße)
  });

  it('übernimmt Spalten, Nur-Text und Abschnitts-Transponierung aus dem Speicher', () => {
    localStorage.setItem(`worship_cols_${SONG_ID}_original`, '2');
    localStorage.setItem(`worship_lyrics_${SONG_ID}_original`, '1');
    localStorage.setItem(`worship_secshift_${SONG_ID}_original`, JSON.stringify({ 1: 2 }));
    const o = loadSongPdfOpts(song({ id: SONG_ID }));
    expect(o.cols).toBe(2);
    expect(o.lyricsOnly).toBe(true);
    expect(o.sectionSemitones).toEqual({ 1: 2 });
  });
});
