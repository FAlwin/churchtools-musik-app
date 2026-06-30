// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { SetlistSong } from '@shared/types/index';
import { loadSecShift, loadSettings } from './chartSettings';

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
