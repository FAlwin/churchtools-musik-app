import { describe, it, expect } from 'vitest';
import { pdfOptionsForSong } from './chartPdfOptions';
import { DEFAULT_SETTINGS, type SongSettings } from './chartSettings';
import type { SetlistSong } from '@shared/types/index';

/**
 * #197: Die Umrechnung Einstellungen → PDF-Optionen lag inline im Render von `ChordChart`. Als
 * reine Funktion ist vor allem die Tonart-Rechnung prüfbar – ein Vorzeichenfehler beim Kapo
 * transponiert das ganze Liederheft falsch, und das fällt erst im Gottesdienst auf.
 */
const song = (over: Partial<SetlistSong> = {}): SetlistSong =>
  ({ id: 1, originalKey: 'C', targetKey: 'D', ...over }) as unknown as SetlistSong;

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
