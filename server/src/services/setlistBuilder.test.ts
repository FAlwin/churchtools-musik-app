import { describe, it, expect } from 'vitest';
import type { CtArrangementFile, CtAgendaItem } from './churchtools.js';
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
  setlistFingerprint,
  diffAgendaItems,
} from './setlistBuilder.js';

describe('diffAgendaItems (#161 – was hat sich im Ablauf geändert)', () => {
  const s = (id: number, sig: string) => ({ id, sig });
  const base = [s(1, 'a'), s(2, 'b'), s(3, 'c'), s(4, 'd')];

  it('kein voriger Stand → nichts geändert (kein Fehlalarm bei Erstnutzung)', () => {
    expect(diffAgendaItems([], base)).toEqual({ changedIds: [], removed: [] });
  });

  it('identisch → nichts geändert', () => {
    expect(diffAgendaItems(base, base)).toEqual({ changedIds: [], removed: [] });
  });

  it('neuer Punkt → als geändert markiert', () => {
    const now = [...base, s(5, 'e')];
    expect(diffAgendaItems(base, now).changedIds).toEqual([5]);
  });

  it('inhaltlich geänderter Punkt (gleiche id, andere Signatur)', () => {
    const now = [s(1, 'a'), s(2, 'B!'), s(3, 'c'), s(4, 'd')];
    expect(diffAgendaItems(base, now).changedIds).toEqual([2]);
  });

  it('entfernter Punkt → removed mit Position (nach dem Vorgänger)', () => {
    const now = [s(1, 'a'), s(2, 'b'), s(4, 'd')];
    const r = diffAgendaItems(base, now);
    expect(r.changedIds).toEqual([]);
    expect(r.removed).toEqual([{ id: 3, title: 'Entfernter Punkt', afterId: 2 }]);
  });

  it('EIN verschobener Punkt → nur dieser gilt als geändert (LIS lässt die anderen in Ruhe)', () => {
    // 4 von hinten nach vorne: [4,1,2,3]. Stehen geblieben: 1,2,3 → nur 4 verschoben.
    const now = [s(4, 'd'), s(1, 'a'), s(2, 'b'), s(3, 'c')];
    expect(diffAgendaItems(base, now).changedIds).toEqual([4]);
  });

  it('Inhaltsänderung ohne Positionswechsel + neu + entfernt', () => {
    // 3 raus; 5 neu ans Ende; 2 inhaltlich geändert – Reihenfolge der bleibenden 1,2,4 unverändert.
    const now = [s(1, 'a'), s(2, 'B!'), s(4, 'd'), s(5, 'e')];
    const r = diffAgendaItems(base, now);
    expect(new Set(r.changedIds)).toEqual(new Set([2, 5]));
    expect(r.removed.map((x) => x.id)).toEqual([3]);
  });
});

/** Minimaler Agenda-Eintrag (nur die für den Fingerabdruck relevanten Felder). */
function item(id: number, song?: { songId: number; arrangementId: number; key: string | null }): CtAgendaItem {
  return {
    id,
    title: song ? 'Lied' : 'Punkt',
    ...(song
      ? { song: { songId: song.songId, arrangementId: song.arrangementId, title: 'x', arrangement: 'y', key: song.key, bpm: null } }
      : {}),
  };
}

describe('setlistFingerprint (#143 – ganze Ablauf-Struktur, Struktur + Details)', () => {
  const base: CtAgendaItem[] = [
    item(1), // Begrüßung (Nicht-Lied)
    item(2, { songId: 10, arrangementId: 100, key: 'G' }),
    item(3, { songId: 11, arrangementId: 110, key: 'D' }),
  ];

  it('identischer Ablauf → gleicher Fingerabdruck', () => {
    expect(setlistFingerprint([...base])).toBe(setlistFingerprint(base));
  });

  it('Nicht-Lied-Punkt verschoben → anderer Fingerabdruck (der eigentliche Bedarf)', () => {
    const swapped = [base[1], base[0], base[2]]; // Begrüßung nach hinten
    expect(setlistFingerprint(swapped)).not.toBe(setlistFingerprint(base));
  });

  it('Punkt hinzugefügt / entfernt → anderer Fingerabdruck', () => {
    expect(setlistFingerprint([...base, item(4)])).not.toBe(setlistFingerprint(base));
    expect(setlistFingerprint([base[0], base[1]])).not.toBe(setlistFingerprint(base));
  });

  it('Lied getauscht / Tonart geändert → anderer Fingerabdruck', () => {
    const rekeyed = [base[0], item(2, { songId: 10, arrangementId: 100, key: 'A' }), base[2]];
    expect(setlistFingerprint(rekeyed)).not.toBe(setlistFingerprint(base));
  });

  it('Punkt umbenannt → anderer Fingerabdruck', () => {
    const renamed = [{ ...base[0], title: 'Anderer Titel' }, base[1], base[2]];
    expect(setlistFingerprint(renamed)).not.toBe(setlistFingerprint(base));
  });

  it('Detail geändert (Verantwortlicher / Dauer / Notiz) → anderer Fingerabdruck', () => {
    const resp = [{ ...base[0], responsible: { text: 'Max' } }, base[1], base[2]];
    expect(setlistFingerprint(resp)).not.toBe(setlistFingerprint(base));
    const dur = [{ ...base[0], duration: 300 }, base[1], base[2]];
    expect(setlistFingerprint(dur)).not.toBe(setlistFingerprint(base));
    const note = [{ ...base[0], note: 'Hinweis' }, base[1], base[2]];
    expect(setlistFingerprint(note)).not.toBe(setlistFingerprint(base));
  });

  it('leere Agenda → leerer Fingerabdruck', () => {
    expect(setlistFingerprint([])).toBe('');
  });
});

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
  it('erkennt den aktuellen (App)-Marker', () => {
    expect(versionNameOf(file('Mein Lied — Akustik (App).chordpro'))).toBe('Akustik');
  });
  it('erkennt weiterhin den alten (ECG)-Marker (Bestandsdateien)', () => {
    expect(versionNameOf(file('Mein Lied — Akustik (ECG).chordpro'))).toBe('Akustik');
  });
  it('behält einen ECG-Bezug im Versionsnamen selbst (nur der Klammer-Marker zählt)', () => {
    expect(versionNameOf(file('Danke — Standard ECG Donrath (App).chordpro'))).toBe(
      'Standard ECG Donrath',
    );
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
  it('baut den (App)-Dateinamen aus Titel + Versionsname', () => {
    expect(versionFileName('Mein Lied', 'Akustik')).toBe('Mein Lied — Akustik (App).chordpro');
  });
  it('entfernt unzulässige Zeichen aus Titel und Name', () => {
    expect(versionFileName('A/B:C', 'X(Y)')).toBe('ABC — XY (App).chordpro');
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
  it('manuelle Freitext-Namen (nur text, persons leer) → als besetzte Personen', () => {
    expect(
      responsibleEntries({
        responsible: { text: 'Willi Heidebrecht, Jakob Friesen', persons: [] },
      }),
    ).toEqual([
      { label: 'Willi Heidebrecht', open: false },
      { label: 'Jakob Friesen', open: false },
    ]);
  });
  it('Dienst-Token im text wird übersprungen (kommt über persons[])', () => {
    expect(
      responsibleEntries({
        responsible: { text: '[Moderation]', persons: [{ service: '[Moderation]', person: { title: 'Willi' } }] },
      }),
    ).toEqual([{ label: 'Willi', open: false }]);
  });
  it('Mischung aus Dienst und Freitext', () => {
    expect(
      responsibleEntries({
        responsible: { text: '[Musik], Anna Beispiel', persons: [{ service: '[Musik]' }] },
      }),
    ).toEqual([
      { label: 'Musik', open: true },
      { label: 'Anna Beispiel', open: false },
    ]);
  });
  it('Freitext-Name doppelt zur aufgelösten Person → dedupliziert', () => {
    expect(
      responsibleEntries({
        responsible: { text: 'Willi', persons: [{ person: { title: 'Willi' } }] },
      }),
    ).toEqual([{ label: 'Willi', open: false }]);
  });
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
