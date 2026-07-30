// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { SetlistSong } from '@shared/types/index';
import { loadSecShift, loadSettings, stepFontSize, FONT_MIN, FONT_MAX } from './chartSettings';

const song = (over: Partial<SetlistSong> = {}): SetlistSong =>
  ({
    id: 5,
    arrangementId: 1,
    title: 'Test',
    author: '',
    originalKey: 'C',
    targetKey: 'C',
    bpm: null,
    timeSig: null,
    ccli: null,
    chordpro: '{key: C}\n[C]Text',
    versions: [],
    documents: [],
    ...over,
  }) as SetlistSong;

beforeEach(() => localStorage.clear());

describe('loadSecShift', () => {
  it('leeres localStorage → {}', () => {
    expect(loadSecShift(5, 'original')).toEqual({});
  });
  it('liest gültige Verschiebungen, filtert 0-Werte und Ungültiges', () => {
    localStorage.setItem('worship_secshift_5_original', JSON.stringify({ 0: 2, 1: -1, 2: 0 }));
    expect(loadSecShift(5, 'original')).toEqual({ 0: 2, 1: -1 });
  });
  it('ungültiges JSON → {}', () => {
    localStorage.setItem('worship_secshift_5_original', 'kein-json');
    expect(loadSecShift(5, 'original')).toEqual({});
  });
});

describe('loadSettings', () => {
  it('leeres localStorage → Standardwerte', () => {
    const s = loadSettings(song());
    expect(s).toMatchObject({
      key: null,
      capo: 0,
      cols: 1,
      fontSize: 20,
      lyricsOnly: false,
      secShift: {},
      versionKey: 'original',
      viewSource: 'chords',
    });
  });
  it('liest gespeicherte Tonart / Kapo / Nur-Text', () => {
    localStorage.setItem('worship_key_5_original', 'D');
    localStorage.setItem('worship_capo_5_original', '2');
    localStorage.setItem('worship_lyrics_5_original', '1');
    const s = loadSettings(song());
    expect(s.key).toBe('D');
    expect(s.capo).toBe(2);
    expect(s.lyricsOnly).toBe(true);
  });
  it('viewSource = fileId, wenn ein gültiges Dokument gespeichert ist', () => {
    const s = loadSettings(song({ documents: [{ fileId: 42, name: 'a.pdf', type: 'pdf' }] }));
    localStorage.setItem('worship_view_5', '42');
    // erneut laden, nachdem der Wert gesetzt ist
    const s2 = loadSettings(song({ documents: [{ fileId: 42, name: 'a.pdf', type: 'pdf' }] }));
    expect(s.viewSource).toBe('chords'); // vor dem Setzen
    expect(s2.viewSource).toBe(42); // nach dem Setzen
  });
  it('viewSource = chords, wenn die gespeicherte fileId nicht (mehr) existiert', () => {
    localStorage.setItem('worship_view_5', '999');
    expect(loadSettings(song()).viewSource).toBe('chords');
  });
});

/**
 * #198: Die Schriftgröße wurde im JSX des Aussehen-Menüs gerechnet (zwei `Math.max`/`Math.min`).
 * Als reine Funktion prüfbar – vor allem, dass sie an den Grenzen stehen bleibt.
 */
describe('stepFontSize', () => {
  it('geht in Zweierschritten hoch und runter', () => {
    expect(stepFontSize(20, 1)).toBe(22);
    expect(stepFontSize(20, -1)).toBe(18);
  });

  it('bleibt an der unteren Grenze stehen, statt darunter zu laufen', () => {
    expect(stepFontSize(FONT_MIN, -1)).toBe(FONT_MIN);
    expect(stepFontSize(FONT_MIN + 1, -1)).toBe(FONT_MIN);
  });

  it('bleibt an der oberen Grenze stehen', () => {
    expect(stepFontSize(FONT_MAX, 1)).toBe(FONT_MAX);
    expect(stepFontSize(FONT_MAX - 1, 1)).toBe(FONT_MAX);
  });

  it('holt einen Wert außerhalb der Grenzen wieder herein', () => {
    expect(stepFontSize(200, 1)).toBe(FONT_MAX);
    expect(stepFontSize(2, -1)).toBe(FONT_MIN);
  });
});
