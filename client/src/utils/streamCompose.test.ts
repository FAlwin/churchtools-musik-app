import { describe, it, expect } from 'vitest';
import { composeStream, docPagesToKeep, type ChordPage } from './streamCompose';
import { DEFAULT_SETTINGS, type SongSettings } from './chartSettings';
import type { SetlistSong } from '@shared/types/index';

/**
 * #251: Das Zusammensetzen des durchgehenden Seitenstroms lag in einem 100-Zeilen-Effekt mit
 * abgeschalteter Hook-Prüfung und war ungetestet. Als reine Funktion ist das Wichtigste prüfbar:
 *
 *  - **Die Besitzer-Zuordnung.** Stimmt `owners` nicht, landen Anmerkungen auf der falschen Seite –
 *    der Fehler, der im Gottesdienst am meisten wehtut.
 *  - **Der Rückfall auf Akkorde**, wenn ein gewähltes Dokument nicht geladen werden konnte. Er ist
 *    gewollt (lieber Akkorde als eine leere Seite), darf aber nicht STILL passieren.
 */
const song = (id: number, docs: { fileId: number; type: 'pdf' | 'image' }[] = []): SetlistSong =>
  ({
    id,
    title: `Lied ${id}`,
    documents: docs.map((d) => ({ ...d, name: `Datei ${d.fileId}` })),
    versions: [],
    chordpro: '',
  }) as unknown as SetlistSong;

const settingsOf = (map: Record<number, Partial<SongSettings>>): Record<number, SongSettings> =>
  Object.fromEntries(
    Object.entries(map).map(([id, over]) => [id, { ...DEFAULT_SETTINGS, ...over }]),
  );

/** Akkord-Seiten je Lied-Index; die „Canvas" ist hier nur ein Name zum Wiedererkennen. */
const chords = (entries: Record<number, string[]>): Map<number, ChordPage<string>[]> =>
  new Map(
    Object.entries(entries).map(([si, names]) => [
      Number(si),
      names.map((canvas) => ({ canvas, versionKey: 'original' })),
    ]),
  );

describe('composeStream – Reihenfolge und Besitzer', () => {
  it('reiht die Akkord-Seiten in Ablauf-Reihenfolge und zählt localPage je Lied neu', () => {
    const r = composeStream({
      songs: [song(10), song(11)],
      settings: settingsOf({}),
      chordBySong: chords({ 0: ['A1', 'A2'], 1: ['B1'] }),
      docPages: new Map(),
    });

    expect(r.pages).toEqual(['A1', 'A2', 'B1']);
    expect(r.owners.map((o) => [o.songId, o.localPage, o.kind])).toEqual([
      [10, 0, 'chord'],
      [10, 1, 'chord'],
      [11, 0, 'chord'],
    ]);
    expect(r.fellBackToChords).toEqual([]);
  });

  it('ein Lied mit gewähltem Dokument bringt SEINE Dokument-Seiten bei, nicht die Akkorde', () => {
    const r = composeStream({
      songs: [song(10, [{ fileId: 77, type: 'pdf' }]), song(11)],
      settings: settingsOf({ 10: { viewSource: 77 } }),
      chordBySong: chords({ 0: ['A1', 'A2'], 1: ['B1'] }),
      docPages: new Map([[77, ['D1', 'D2', 'D3']]]),
    });

    expect(r.pages).toEqual(['D1', 'D2', 'D3', 'B1']);
    const doc = r.owners.filter((o) => o.kind === 'doc');
    expect(doc).toHaveLength(3);
    expect(doc[0]).toMatchObject({ songId: 10, localPage: 0, fileId: 77, docType: 'pdf' });
    // Der Versions-Schlüssel unterscheidet die Anmerkungs-Ebene: Dokument ≠ Akkorde.
    expect(doc[0].versionKey).toBe('doc');
  });

  it('behält den Versions-Schlüssel der Akkord-Seiten (versionsbezogene Anmerkungen)', () => {
    const r = composeStream({
      songs: [song(10)],
      settings: settingsOf({}),
      chordBySong: new Map([[0, [{ canvas: 'A1', versionKey: 'akustik' }]]]),
      docPages: new Map(),
    });
    expect(r.owners[0].versionKey).toBe('akustik');
  });

  it('ein Lied ohne Seiten fällt einfach aus – ohne die Zuordnung der anderen zu verschieben', () => {
    const r = composeStream({
      songs: [song(10), song(11), song(12)],
      settings: settingsOf({}),
      chordBySong: chords({ 0: ['A1'], 2: ['C1'] }), // Lied 11 hat nichts
      docPages: new Map(),
    });
    expect(r.pages).toEqual(['A1', 'C1']);
    expect(r.owners.map((o) => o.songId)).toEqual([10, 12]);
    // songIdx zeigt weiter auf die ECHTE Position im Ablauf (2, nicht 1).
    expect(r.owners[1].songIdx).toBe(2);
  });
});

describe('composeStream – Rückfall auf Akkorde ist sichtbar (#251)', () => {
  it('nicht geladenes Dokument → Akkorde, und das Lied wird gemeldet', () => {
    const r = composeStream({
      songs: [song(10, [{ fileId: 77, type: 'pdf' }])],
      settings: settingsOf({ 10: { viewSource: 77 } }),
      chordBySong: chords({ 0: ['A1'] }),
      docPages: new Map(), // Rendern ist gescheitert
    });

    expect(r.pages).toEqual(['A1']);
    expect(r.owners[0].kind).toBe('chord');
    expect(r.fellBackToChords).toEqual([10]); // nicht stillschweigend!
  });

  it('ein LEER gerendertes Dokument gilt auch als Fehlschlag', () => {
    const r = composeStream({
      songs: [song(10, [{ fileId: 77, type: 'pdf' }])],
      settings: settingsOf({ 10: { viewSource: 77 } }),
      chordBySong: chords({ 0: ['A1'] }),
      docPages: new Map([[77, []]]),
    });
    expect(r.fellBackToChords).toEqual([10]);
  });

  it('eine Auswahl auf ein Dokument, das das Lied nicht hat, meldet NICHT (nur Akkorde)', () => {
    // Kein Fehlschlag, sondern eine veraltete Auswahl – dafür gibt es nichts zu melden.
    const r = composeStream({
      songs: [song(10)],
      settings: settingsOf({ 10: { viewSource: 999 } }),
      chordBySong: chords({ 0: ['A1'] }),
      docPages: new Map(),
    });
    expect(r.pages).toEqual(['A1']);
    expect(r.fellBackToChords).toEqual([]);
  });
});

describe('docPagesToKeep – Vorrat begrenzen', () => {
  it('behält nur die aktuell gewählten Dokumente', () => {
    const keep = docPagesToKeep(
      [song(10, [{ fileId: 77, type: 'pdf' }]), song(11, [{ fileId: 88, type: 'pdf' }])],
      settingsOf({ 10: { viewSource: 77 } }), // Lied 11 zeigt Akkorde
    );
    expect([...keep]).toEqual([77]);
  });

  it('ohne gewähltes Dokument bleibt nichts übrig', () => {
    expect([...docPagesToKeep([song(10)], settingsOf({}))]).toEqual([]);
  });
});
