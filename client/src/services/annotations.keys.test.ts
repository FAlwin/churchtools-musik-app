import { describe, it, expect } from 'vitest';
import { KEY_RE } from './annotations';
import { drawKeyForOwner, zoomKeyBaseForOwner, viewKeyForOwner } from '../utils/streamKeys';
import { ANNO_DRAW_NS, ANNO_ZOOM_NS, zoomLayoutSuffix } from '@shared/keys/index';
import type { StreamOwner } from '../utils/streamCompose';

/**
 * Der Sync-Filter `KEY_RE` MUSS zu den Schlüsseln passen, die die App tatsächlich **erzeugt**. Genau
 * eine Drift zwischen beiden hat den Zoom-Sync im Querformat lahmgelegt: Der Zoom-Schlüssel endet auf
 * die Layout-Ziffer (`_dlarge2` im 2-up), die `KEY_RE` früher nicht erlaubte → `pushField` verwarf
 * den Zoom.
 *
 * ⚠️ **Umgestellt in #250:** Vorher prüfte diese Datei **handgeschriebene Literale**. Hätte
 * `drawKeyFor` künftig `_lyrics` statt `_lyr` gebaut, wären alle Tests grün geblieben und der Sync
 * wäre wieder still gestorben – also genau der Fehler, den sie festhalten sollen. Jetzt laufen die
 * Prüfungen gegen die **Erzeuger** aus `utils/streamKeys`; die Literale bleiben nur als zusätzliche
 * Absicherung des Formats stehen.
 */
const chordOwner = (over: Partial<StreamOwner> = {}): StreamOwner => ({
  songIdx: 0,
  songId: 12,
  localPage: 0,
  kind: 'chord',
  versionKey: 'original',
  ...over,
});

const docOwner = (over: Partial<StreamOwner> = {}): StreamOwner => ({
  songIdx: 0,
  songId: 12,
  localPage: 0,
  kind: 'doc',
  versionKey: 'doc',
  fileId: 98765,
  docType: 'pdf',
  ...over,
});

/** Wie im Client: der Server sieht den Schlüssel OHNE Namensraum. */
const serverPart = (key: string): string => key.replace(ANNO_DRAW_NS, '').replace(ANNO_ZOOM_NS, '');

describe('KEY_RE gegen die ERZEUGER (#250)', () => {
  it('was drawKeyForOwner baut, akzeptiert der Sync-Filter', () => {
    for (const owner of [
      chordOwner(),
      chordOwner({ versionKey: 'akustik-2024', localPage: 3 }),
      chordOwner({ songId: 7, localPage: 12 }),
    ]) {
      for (const lyricsOnly of [false, true]) {
        const key = drawKeyForOwner(owner, lyricsOnly);
        expect(key.startsWith(ANNO_DRAW_NS)).toBe(true);
        expect(KEY_RE.test(serverPart(key))).toBe(true);
      }
    }
  });

  it('was zoomKeyBaseForOwner baut, akzeptiert der Filter – auch MIT Layout-Suffix', () => {
    // Der Kernfall der damaligen Drift: die Layout-Ziffer im Querformat/2-up.
    for (const lyricsOnly of [false, true]) {
      const base = zoomKeyBaseForOwner(chordOwner(), lyricsOnly);
      for (const [geraet, spalten] of [
        ['large', 2],
        ['large', 1],
        ['phone', 1],
      ] as const) {
        const key = base + zoomLayoutSuffix(geraet, spalten);
        expect(KEY_RE.test(serverPart(key))).toBe(true);
      }
    }
  });

  it('Dokument-Schlüssel werden vom Filter abgelehnt – die bleiben bewusst lokal', () => {
    const draw = drawKeyForOwner(docOwner(), false);
    const zoom = zoomKeyBaseForOwner(docOwner({ localPage: 1 }), false);
    expect(KEY_RE.test(serverPart(draw))).toBe(false);
    expect(KEY_RE.test(serverPart(zoom + zoomLayoutSuffix('large', 2)))).toBe(false);
  });

  it('die Nur-Text-Ebene ist eine EIGENE Ebene (anderer Schlüssel)', () => {
    const owner = chordOwner();
    expect(drawKeyForOwner(owner, true)).not.toBe(drawKeyForOwner(owner, false));
    // …und beide sind gültig.
    expect(KEY_RE.test(serverPart(drawKeyForOwner(owner, true)))).toBe(true);
    expect(KEY_RE.test(serverPart(drawKeyForOwner(owner, false)))).toBe(true);
  });

  it('Anmerkung und Zoom derselben Seite liegen in getrennten Namensräumen', () => {
    // Sonst würde ein Zoom die Striche überschreiben.
    const owner = chordOwner();
    expect(drawKeyForOwner(owner, false)).not.toBe(zoomKeyBaseForOwner(owner, false));
    expect(serverPart(drawKeyForOwner(owner, false))).toBe(
      serverPart(zoomKeyBaseForOwner(owner, false)),
    );
  });

  it('verschiedene Seiten und Versionen ergeben verschiedene Schlüssel', () => {
    const keys = new Set([
      drawKeyForOwner(chordOwner({ localPage: 0 }), false),
      drawKeyForOwner(chordOwner({ localPage: 1 }), false),
      drawKeyForOwner(chordOwner({ versionKey: 'akustik' }), false),
      drawKeyForOwner(chordOwner({ songId: 13 }), false),
    ]);
    expect(keys.size).toBe(4);
  });
});

describe('viewKeyForOwner – die angesehene fremde Ebene', () => {
  const VIEW_NS = 'worship_viewmirror_';

  it('baut den Schlüssel im Ansichts-Namensraum, gültig für den Filter', () => {
    const key = viewKeyForOwner(
      chordOwner(),
      { songId: 12, versionKey: 'original', lyr: false },
      VIEW_NS,
    );
    expect(key?.startsWith(VIEW_NS)).toBe(true);
    expect(KEY_RE.test(key!.replace(VIEW_NS, ''))).toBe(true);
  });

  it('gilt nur für das angesehene Lied und nie für Dokument-Seiten', () => {
    const andereSong = viewKeyForOwner(
      chordOwner({ songId: 99 }),
      { songId: 12, versionKey: 'original', lyr: false },
      VIEW_NS,
    );
    expect(andereSong).toBeNull();

    const dok = viewKeyForOwner(
      docOwner(),
      { songId: 12, versionKey: 'original', lyr: false },
      VIEW_NS,
    );
    expect(dok).toBeNull();
  });

  it('ohne Ansicht gibt es keinen Schlüssel', () => {
    expect(viewKeyForOwner(chordOwner(), null, VIEW_NS)).toBeNull();
  });
});

/** Zusätzlich das Format selbst festhalten – falls jemand die Erzeuger UND den Filter zugleich ändert. */
describe('KEY_RE – das Format (Literale als zweite Absicherung)', () => {
  it('akzeptiert die bekannten gültigen Formen', () => {
    for (const k of [
      'song12_voriginal_0',
      'song7_vakustik-2024_3',
      'song12_voriginal_lyr_0',
      'song12_voriginal_0_dlarge2',
      'song12_voriginal_0_dlarge', // Altbestand ohne Ziffer
    ]) {
      expect(KEY_RE.test(k)).toBe(true);
    }
  });

  it('lehnt kaputte Formen ab', () => {
    for (const k of ['', 'foo', 'song12_0', 'song12_lyr_0', '98765_0']) {
      expect(KEY_RE.test(k)).toBe(false);
    }
  });
});
