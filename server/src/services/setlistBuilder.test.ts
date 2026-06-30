import { describe, it, expect } from 'vitest';
import type { CtArrangementFile } from './churchtools.js';
import {
  versionSlug,
  versionNameOf,
  versionFileName,
  documentsOf,
  metaValue,
  isHeaderType,
  formatBerlinTime,
  cleanServiceName,
  responsibleEntries,
} from './setlistBuilder.js';

/** Baut eine Test-Datei (nur die für die Logik relevanten Felder). */
const file = (name: string, id?: number): CtArrangementFile =>
  ({
    name,
    fileUrl: id === undefined ? '' : `https://x.church.tools/?q=public/filedownload&id=${id}`,
  }) as unknown as CtArrangementFile;

describe('versionSlug', () => {
  it('macht aus einem Namen einen kleingeschriebenen Slug', () => {
    expect(versionSlug('Akustik')).toBe('akustik');
  });
  it('entfernt Akzente und ersetzt Sonderzeichen durch Bindestriche', () => {
    expect(versionSlug('Café Jugend!')).toBe('cafe-jugend');
  });
  it('liefert einen Fallback, wenn nichts Brauchbares übrig bleibt', () => {
    expect(versionSlug('!!!')).toBe('version');
  });
});

describe('versionNameOf (Versions-Erkennung, abwärtskompatibel)', () => {
  it('erkennt den neuen (ECG)-Marker', () => {
    expect(versionNameOf(file('Mein Lied — Akustik (ECG).chordpro'))).toBe('Akustik');
  });
  it('erkennt das alte „— Bearbeitet.chordpro"', () => {
    expect(versionNameOf(file('Mein Lied — Bearbeitet.chordpro'))).toBe('Bearbeitet');
  });
  it('erkennt das alte „— ECG.chordpro" (→ Name „Bearbeitet")', () => {
    expect(versionNameOf(file('Mein Lied — ECG.chordpro'))).toBe('Bearbeitet');
  });
  it('behandelt eine normale Originaldatei NICHT als Version', () => {
    expect(versionNameOf(file('Mein Lied.chordpro'))).toBeNull();
  });
  it('verwechselt einen Bindestrich im Original-Titel NICHT mit einer Version', () => {
    expect(versionNameOf(file('Lobe den Herrn - live.chordpro'))).toBeNull();
  });
});

describe('versionFileName', () => {
  it('baut den (ECG)-Dateinamen aus Titel + Versionsname', () => {
    expect(versionFileName('Mein Lied', 'Akustik')).toBe('Mein Lied — Akustik (ECG).chordpro');
  });
  it('entfernt unzulässige Zeichen aus Titel und Name', () => {
    expect(versionFileName('A/B:C', 'X(Y)')).toBe('ABC — XY (ECG).chordpro');
  });
});

describe('metaValue (ChordPro-Metadaten)', () => {
  it('liest {key: E}', () => expect(metaValue('{key: E}\n[E]Text', 'key')).toBe('E'));
  it('liest mehrstellige Werte {key:Ab}', () => expect(metaValue('{key:Ab}', 'key')).toBe('Ab'));
  it('liefert null, wenn der Schlüssel fehlt', () => expect(metaValue('[C]nur Text', 'key')).toBeNull());
});

describe('isHeaderType', () => {
  it('header → true', () => expect(isHeaderType('header')).toBe(true));
  it('section → true', () => expect(isHeaderType('section')).toBe(true));
  it('song → false', () => expect(isHeaderType('song')).toBe(false));
  it('undefined → false', () => expect(isHeaderType(undefined)).toBe(false));
});

describe('formatBerlinTime (Zeitzone Europe/Berlin)', () => {
  it('UTC → deutsche Sommerzeit (CEST, +2)', () => {
    expect(formatBerlinTime('2026-06-30T09:05:00Z')).toBe('11:05');
  });
  it('UTC → deutsche Winterzeit (CET, +1)', () => {
    expect(formatBerlinTime('2026-01-15T09:05:00Z')).toBe('10:05');
  });
  it('null → null', () => expect(formatBerlinTime(null)).toBeNull());
  it('ungültiges Datum → null', () => expect(formatBerlinTime('keine-zeit')).toBeNull());
});

describe('cleanServiceName (CT-Dienst-Token säubern)', () => {
  it('entfernt Klammern und nachgestelltes Fragezeichen', () => {
    expect(cleanServiceName('[Kamera Studio]?')).toBe('Kamera Studio');
  });
  it('[Musik] → Musik', () => expect(cleanServiceName('[Musik]')).toBe('Musik'));
  it('undefined → leerer String', () => expect(cleanServiceName(undefined)).toBe(''));
});

describe('responsibleEntries (Zuständige, dedupliziert)', () => {
  it('besetzte Person → open=false', () => {
    expect(responsibleEntries({ responsible: { persons: [{ person: { title: 'Max Muster' } }] } })).toEqual([
      { label: 'Max Muster', open: false },
    ]);
  });
  it('offener Dienstplatz → Dienstname, open=true', () => {
    expect(responsibleEntries({ responsible: { persons: [{ service: '[Musik]' }] } })).toEqual([
      { label: 'Musik', open: true },
    ]);
  });
  it('entfernt doppelte Einträge', () => {
    expect(
      responsibleEntries({
        responsible: { persons: [{ person: { title: 'Anna' } }, { person: { title: 'Anna' } }] },
      }),
    ).toEqual([{ label: 'Anna', open: false }]);
  });
  it('leere Zuständigkeit → leeres Array', () => expect(responsibleEntries({})).toEqual([]));
});

describe('documentsOf (PDF/Bild-Dokumente)', () => {
  it('erkennt PDF und Bild, ignoriert ChordPro', () => {
    expect(documentsOf([file('chart.pdf', 1), file('foto.jpg', 2), file('lied.chordpro', 3)])).toEqual([
      { fileId: 1, name: 'chart.pdf', type: 'pdf' },
      { fileId: 2, name: 'foto.jpg', type: 'image' },
    ]);
  });
  it('überspringt Dateien ohne id in der URL', () => {
    expect(documentsOf([{ name: 'x.pdf', fileUrl: 'https://x.ct/ohne-id' } as unknown as CtArrangementFile])).toEqual(
      [],
    );
  });
});
