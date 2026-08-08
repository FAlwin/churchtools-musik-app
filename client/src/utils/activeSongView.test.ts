import { describe, expect, it } from 'vitest';
import { deriveActiveSongView } from './activeSongView';
import { DEFAULT_SETTINGS, type SongSettings } from './chartSettings';
import type { SetlistSong } from '@shared/types/index';

/**
 * #314: Diese Ableitungen lagen als lose Konstanten in `ChordChart.tsx` und waren ungetestet,
 * obwohl an ihnen die Kopfzeile, das Lied-Menü und der Start-Text des Editors hängen.
 *
 * Zwei Dinge sind hier das Wichtige: dass die **Kapo-Rechnung ein Abzug** bleibt (ein Vorzeichen-
 * fehler ergibt Griffe in der falschen Tonart, #239 in klein), und dass die **Info-Zeile** nur
 * zeigt, was gerade gilt – bei „Nur Text" hat eine Tonart nichts zu suchen.
 */
const song = (over: Partial<SetlistSong> = {}): SetlistSong =>
  ({
    id: 12,
    title: 'Großer Gott',
    originalKey: 'C',
    targetKey: 'D',
    bpm: null,
    chordpro: '{title: Großer Gott}\n[D]Zeile',
    versions: [],
    documents: [],
    ...over,
  }) as unknown as SetlistSong;

const set = (over: Partial<SongSettings> = {}): SongSettings => ({ ...DEFAULT_SETTINGS, ...over });

describe('deriveActiveSongView – Tonart und Kapo', () => {
  it('nimmt die Ziel-Tonart des Lieds, solange keine eigene gewählt ist', () => {
    expect(deriveActiveSongView(song(), set()).curKey).toBe('D');
  });

  it('lässt die eigene Tonart-Wahl gewinnen', () => {
    expect(deriveActiveSongView(song(), set({ key: 'G' })).curKey).toBe('G');
  });

  it('ZIEHT den Kapo ab: Kapo 2 heißt zwei Halbtöne tiefer greifen', () => {
    // Klingt D, Kapo im 2. Bund → gegriffen wird C. Ein Vorzeichenfehler ergäbe E.
    const v = deriveActiveSongView(song(), set({ capo: 2 }));
    expect(v.curKey).toBe('D');
    expect(v.shapeKey).toBe('C');
  });
});

describe('deriveActiveSongView – Versionen', () => {
  it('führt das Original als erste Auswahl und erkennt es als Original', () => {
    const v = deriveActiveSongView(song(), set());
    expect(v.currentVersion.key).toBe('original');
    expect(v.isOriginal).toBe(true);
    expect(v.hasVersions).toBe(false);
  });

  it('wählt die gespeicherte Version und liefert deren Text', () => {
    const s = song({ versions: [{ key: 'akustik', name: 'Akustik', text: '[G]Anders' }] });
    const v = deriveActiveSongView(s, set({ versionKey: 'akustik' }));
    expect(v.currentVersion.name).toBe('Akustik');
    expect(v.isOriginal).toBe(false);
    expect(v.hasVersions).toBe(true);
    expect(v.displayedChordpro).toBe('[G]Anders');
  });

  it('fällt aufs Original zurück, wenn die gespeicherte Version in ChurchTools weg ist', () => {
    const v = deriveActiveSongView(song(), set({ versionKey: 'geloescht' }));
    expect(v.currentVersion.key).toBe('original');
  });
});

describe('deriveActiveSongView – gewähltes Dokument', () => {
  it('zeigt Akkorde, solange kein Dokument gewählt ist', () => {
    expect(deriveActiveSongView(song(), set()).activeDoc).toBeNull();
  });

  it('findet das gewählte Dokument über seine Datei-ID', () => {
    const s = song({ documents: [{ fileId: 77, name: 'Noten.pdf', type: 'pdf' }] });
    expect(deriveActiveSongView(s, set({ viewSource: 77 })).activeDoc?.fileId).toBe(77);
  });

  it('fällt auf Akkorde zurück, wenn das gewählte Dokument nicht mehr existiert', () => {
    expect(deriveActiveSongView(song(), set({ viewSource: 999 })).activeDoc).toBeNull();
  });
});

describe('deriveActiveSongView – Info-Zeile im Kopf', () => {
  it('zeigt bei Akkorden die Tonart', () => {
    expect(deriveActiveSongView(song(), set()).headInfo).toEqual([{ art: 'key', text: 'D' }]);
  });

  it('zeigt bei „Nur Text" KEINE Tonart – sie sagt dort nichts aus', () => {
    const info = deriveActiveSongView(song(), set({ lyricsOnly: true, capo: 3 })).headInfo;
    expect(info).toEqual([{ art: 'plain', text: 'Nur Text' }]);
    expect(info.some((p) => p.art === 'key' || p.art === 'capo')).toBe(false);
  });

  it('zeigt den Kapo nur, wenn einer gesetzt ist', () => {
    expect(deriveActiveSongView(song(), set()).headInfo).not.toContainEqual({
      art: 'capo',
      text: 'Capo 0',
    });
    expect(deriveActiveSongView(song(), set({ capo: 2 })).headInfo).toContainEqual({
      art: 'capo',
      text: 'Capo 2',
    });
  });

  it('nennt Version und Tempo in dieser Reihenfolge, wenn beides da ist', () => {
    const s = song({ bpm: 72, versions: [{ key: 'akustik', name: 'Akustik', text: 'x' }] });
    const info = deriveActiveSongView(s, set({ versionKey: 'akustik' })).headInfo;
    expect(info.map((p) => p.art)).toEqual(['key', 'plain', 'bpm']);
    // Der Tempo-Teil trägt bewusst KEINE fertige Beschriftung: Symbol und Zahl setzt die Kopfzeile,
    // und angezeigt wird dort ggf. das im Tempo-Menü eingestellte Tempo statt dieses hier.
    expect(info.filter((p) => p.art !== 'bpm').map((p) => (p as { text: string }).text)).toEqual([
      'D',
      'Akustik',
    ]);
    expect(info).toContainEqual({ art: 'bpm', bpm: 72 });
  });

  it('zeigt bei einem Dokument nur dessen Art – Tonart und Kapo gelten dort nicht', () => {
    const s = song({ bpm: 72, documents: [{ fileId: 77, name: 'Scan', type: 'image' }] });
    const info = deriveActiveSongView(s, set({ viewSource: 77, capo: 2 })).headInfo;
    expect(info).toEqual([{ art: 'plain', text: 'Bild' }]);
  });
});

describe('deriveActiveSongView – Editor-Vorlage', () => {
  it('setzt Titel und Tonart des Lieds ein', () => {
    const t = deriveActiveSongView(song(), set()).editorTemplate;
    expect(t).toContain('{title: Großer Gott}');
    expect(t).toContain('{key: D}');
  });

  it('fällt auf die Original-Tonart zurück, wenn keine Ziel-Tonart hinterlegt ist', () => {
    const t = deriveActiveSongView(song({ targetKey: '' }), set()).editorTemplate;
    expect(t).toContain('{key: C}');
  });
});
