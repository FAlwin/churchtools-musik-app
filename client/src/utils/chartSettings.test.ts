// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { SetlistSong } from '@shared/types/index';
import {
  loadSecShift,
  loadSettings,
  settingsForLevel,
  stepFontSize,
  DEFAULT_SETTINGS,
  FONT_MIN,
  FONT_MAX,
} from './chartSettings';

const song = (over: Partial<SetlistSong> = {}): SetlistSong => ({
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
});

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

/**
 * #247: `settingsForLevel` baute die Einstellungen daneben selbst – ohne `intOr` (NaN-Gefahr im
 * Kapo), mit hartkodierter Standard-Schriftgröße und **ohne die Schlüssel-Rückfälle** aus
 * `songVersions`. Es ist der Pfad für „Notizen von …": Man sieht die Ansicht eines Teamkollegen.
 * Wer seine Einstellungen noch unter einem älteren Schlüssel hatte, wurde mit Standardwerten
 * dargestellt – seine Tonart, Spaltenzahl und Schriftgröße wurden ignoriert.
 *
 * Jetzt teilen `loadSettings` und `settingsForLevel` EINEN Bauer, der nur seine Quelle wechselt.
 */
describe('settingsForLevel – dieselbe Umrechnung wie loadSettings (#247)', () => {
  const s = song({ id: 42 });

  it('liest Tonart, Kapo, Spalten, Schrift und Abschnitte aus der Tabelle', () => {
    const map = {
      worship_key_42_akustik: 'F',
      worship_capo_42_akustik: '3',
      worship_cols_42_akustik: '2',
      worship_fs_42_akustik: '28',
      worship_secshift_42_akustik: JSON.stringify({ 1: 2 }),
    };
    const st = settingsForLevel(s, map, 'akustik', false);
    expect(st.key).toBe('F');
    expect(st.capo).toBe(3);
    expect(st.cols).toBe(2);
    expect(st.fontSize).toBe(28);
    expect(st.secShift).toEqual({ 1: 2 });
    expect(st.versionKey).toBe('akustik');
    expect(st.viewSource).toBe('chords');
  });

  it('Unsinn in der Tabelle ergibt KEIN NaN (das zerstörte das ganze Blatt)', () => {
    const st = settingsForLevel(s, { worship_capo_42_akustik: 'kaputt' }, 'akustik', false);
    expect(Number.isNaN(st.capo)).toBe(false);
    expect(st.capo).toBe(DEFAULT_SETTINGS.capo);
  });

  it('fehlende Werte kommen aus DEFAULT_SETTINGS, nicht aus hartkodierten Zahlen', () => {
    const st = settingsForLevel(s, {}, 'akustik', false);
    expect(st.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(st.cols).toBe(DEFAULT_SETTINGS.cols);
    expect(st.capo).toBe(DEFAULT_SETTINGS.capo);
  });

  it('DER Fall von #247: die Schlüssel-Rückfälle gelten auch hier', () => {
    // Der Kollege hat seine Werte noch unter dem alten Geräteklassen-Schlüssel …
    const alt = { worship_fs_42_akustik_dlarge: '30' };
    expect(settingsForLevel(s, alt, 'akustik', false).fontSize).toBe(30);
    // … oder, beim Original, unter dem alten song-only-Schlüssel.
    const songOnly = { worship_cols_42: '2' };
    expect(settingsForLevel(s, songOnly, 'original', false).cols).toBe(2);
  });

  it('die Darstellungsart kommt von außen, nicht aus der Tabelle', () => {
    // Die angesehene Ebene bestimmt sie – ein abweichender Wert in der Tabelle darf nicht gewinnen.
    const map = { worship_lyrics_42_akustik: '1' };
    expect(settingsForLevel(s, map, 'akustik', false).lyricsOnly).toBe(false);
    expect(settingsForLevel(s, {}, 'akustik', true).lyricsOnly).toBe(true);
  });

  it('liefert für dieselben Rohwerte dasselbe wie loadSettings', () => {
    // Der eigentliche Vertrag: Quelle Gerät vs. Quelle Tabelle darf nichts ändern.
    const roh = {
      worship_key_42_akustik: 'A',
      worship_capo_42_akustik: '2',
      worship_cols_42_akustik: '2',
      worship_fs_42_akustik: '24',
    };
    for (const [k, v] of Object.entries(roh)) localStorage.setItem(k, v);

    const vomGeraet = loadSettings(s, 'akustik');
    const ausTabelle = settingsForLevel(s, roh, 'akustik', vomGeraet.lyricsOnly);

    expect(ausTabelle.key).toBe(vomGeraet.key);
    expect(ausTabelle.capo).toBe(vomGeraet.capo);
    expect(ausTabelle.cols).toBe(vomGeraet.cols);
    expect(ausTabelle.fontSize).toBe(vomGeraet.fontSize);
  });
});
