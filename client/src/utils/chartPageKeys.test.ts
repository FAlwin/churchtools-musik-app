import { describe, expect, it } from 'vitest';
import {
  drawKeyForPage,
  isLyricsOnlyFor,
  pageLabelFor,
  viewKeyForPage,
  zoomKeyBaseForPage,
} from './chartPageKeys';
import { DEFAULT_SETTINGS, type SongSettings } from './chartSettings';
import type { StreamOwner } from './streamCompose';

/**
 * #314: Diese Entscheidung lag inline in `ChordChart.tsx` (860 Zeilen, kein Test) – und an ihr hängt,
 * auf welcher Ebene ein gezeichneter Strich landet. Die beiden Fehler, die es hier schon gab, waren
 * #199 (Konten teilten sich einen Schlüssel) und #250 (Schlüssel-Grammatik).
 *
 * Geprüft wird deshalb nicht die Grammatik – die gehört `annotationKeys`/`streamKeys` und ist dort
 * getestet –, sondern die Zuordnung: **welche Darstellungsart gilt, welche Seite gehört wem, und wann
 * gibt es KEINEN Schlüssel.**
 */
const owner = (over: Partial<StreamOwner> = {}): StreamOwner => ({
  songIdx: 0,
  songId: 12,
  localPage: 0,
  kind: 'chord',
  versionKey: 'original',
  ...over,
});

const settingsOf = (map: Record<number, Partial<SongSettings>>): Record<number, SongSettings> =>
  Object.fromEntries(
    Object.entries(map).map(([id, over]) => [id, { ...DEFAULT_SETTINGS, ...over }]),
  );

describe('isLyricsOnlyFor – der veröffentlichte Schnappschuss gewinnt', () => {
  it('nimmt die Darstellungsart des VERÖFFENTLICHTEN Schnappschusses, nicht die live gewählte', () => {
    // Der Nutzer hat soeben „Nur Text" abgewählt, die sichtbaren Seiten sind aber noch die alten.
    const published = settingsOf({ 12: { lyricsOnly: true } });
    const live = settingsOf({ 12: { lyricsOnly: false } });
    expect(isLyricsOnlyFor(12, published, live)).toBe(true);
  });

  it('fällt auf die Live-Einstellung zurück, solange nichts veröffentlicht ist', () => {
    expect(isLyricsOnlyFor(12, {}, settingsOf({ 12: { lyricsOnly: true } }))).toBe(true);
  });

  it('fällt auf die Standardwerte zurück, wenn das Lied nirgends steht', () => {
    expect(isLyricsOnlyFor(99, {}, {})).toBe(DEFAULT_SETTINGS.lyricsOnly);
  });
});

describe('drawKeyForPage – eigene Anmerkungs-Ebene je Seite', () => {
  it('trennt „Nur Text" von „Akkorde & Text" – und richtet sich nach dem Schnappschuss', () => {
    const owners = [owner()];
    const mitLyr = drawKeyForPage(0, owners, settingsOf({ 12: { lyricsOnly: true } }), {});
    const ohneLyr = drawKeyForPage(0, owners, settingsOf({ 12: { lyricsOnly: false } }), {});
    expect(mitLyr).toContain('_lyr_');
    expect(ohneLyr).not.toContain('_lyr_');
    expect(mitLyr).not.toBe(ohneLyr);
  });

  it('gibt für eine Seite ohne Besitzer null zurück (Strom wird gerade neu gebaut)', () => {
    expect(drawKeyForPage(3, [owner()], {}, {})).toBeNull();
  });

  it('hängt bei Dokument-Seiten an der Datei-ID, nicht an Lied und Version', () => {
    const docOwner = owner({ kind: 'doc', fileId: 777, versionKey: 'akustik' });
    const key = drawKeyForPage(0, [docOwner], settingsOf({ 12: { lyricsOnly: true } }), {});
    expect(key).toContain('777_0');
    // Die Darstellungsart darf hier gar nicht durchschlagen – ein Dokument hat keine „Nur Text"-Ebene.
    expect(key).not.toContain('_lyr');
    expect(key).not.toContain('akustik');
  });
});

describe('zoomKeyBaseForPage – der Zoom braucht immer einen Schlüssel', () => {
  it('liefert auch ohne Besitzer einen Schlüssel, und zwar je Seitenzahl einen eigenen', () => {
    const a = zoomKeyBaseForPage(3, [], {}, {});
    const b = zoomKeyBaseForPage(4, [], {}, {});
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('kann mit dem Ersatz-Schlüssel keine echte Ebene überschreiben', () => {
    const ersatz = zoomKeyBaseForPage(0, [], {}, {});
    const echt = zoomKeyBaseForPage(0, [owner()], {}, {});
    expect(ersatz).not.toBe(echt);
  });

  it('folgt derselben Darstellungsart-Regel wie die Anmerkungen', () => {
    const owners = [owner()];
    expect(zoomKeyBaseForPage(0, owners, settingsOf({ 12: { lyricsOnly: true } }), {})).toContain(
      '_lyr_',
    );
  });
});

describe('viewKeyForPage – die angesehene fremde Ebene', () => {
  it('gibt null zurück, wenn niemand angesehen wird', () => {
    expect(viewKeyForPage(0, [owner()], null, 'view_')).toBeNull();
  });

  it('gibt null für Seiten zurück, die nicht zum angesehenen Lied gehören', () => {
    const owners = [owner({ songId: 12 }), owner({ songId: 34, songIdx: 1 })];
    expect(viewKeyForPage(1, owners, { songId: 12, lyr: false }, 'view_')).toBeNull();
  });

  it('nimmt die Darstellungsart der ANGESEHENEN Person, nicht den eigenen Schnappschuss', () => {
    const owners = [owner()];
    // Eigener Schnappschuss sagt „Akkorde & Text", angesehen wird ihre „Nur Text"-Ebene.
    const key = viewKeyForPage(0, owners, { songId: 12, lyr: true }, 'view_');
    expect(key).toContain('_lyr_');
    expect(key?.startsWith('view_')).toBe(true);
  });

  it('teilt keine Dokument-Anmerkungen (nur Akkord-Seiten)', () => {
    const owners = [owner({ kind: 'doc', fileId: 777 })];
    expect(viewKeyForPage(0, owners, { songId: 12, lyr: false }, 'view_')).toBeNull();
  });
});

describe('pageLabelFor – „Seite x / y" nur bei mehrseitigen Einheiten', () => {
  it('schweigt bei einer einseitigen Einheit', () => {
    expect(pageLabelFor(0, 0, [owner()])).toBeNull();
  });

  it('zählt die Seiten der Einheit und zeigt die Position darin', () => {
    const owners = [owner({ localPage: 0 }), owner({ localPage: 1 })];
    expect(pageLabelFor(1, 1, owners)).toBe('Seite 2 / 2');
  });

  it('zählt je Ablauf-Position, nicht je Lied – dasselbe Lied zweimal sind zwei Einheiten', () => {
    const owners = [
      owner({ songIdx: 0, localPage: 0 }),
      owner({ songIdx: 0, localPage: 1 }),
      owner({ songIdx: 1, localPage: 0 }), // dasselbe Lied, zweiter Ablaufpunkt
    ];
    expect(pageLabelFor(2, 2, owners)).toBeNull(); // eigene Einheit, nur eine Seite
  });

  it('fällt auf die linke Seite zurück, wenn die aktive Seite keinen Besitzer hat', () => {
    const owners = [owner({ localPage: 0 }), owner({ localPage: 1 })];
    expect(pageLabelFor(9, 0, owners)).toBe('Seite 1 / 2');
  });

  it('gibt null zurück, wenn es überhaupt keine Besitzer gibt', () => {
    expect(pageLabelFor(0, 0, [])).toBeNull();
  });
});
