// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  chartHead,
  generateChordPdf,
  generateSetlistPdf,
  generateSetlistPdfWithOwners,
} from './chordPdf';
import type { SetlistSong } from '@shared/types/index';

/**
 * #192: `chordPdf.ts` ist der Kern der App (ChordPro → A4-Seiten) und war bei 0 % Abdeckung – ein
 * Fehler hier zerstört jedes Chart im Gottesdienst.
 *
 * Getestet wird bewusst der **Vertrag**, nicht das PDF-Binary: Wie viele Seiten entstehen, und
 * welche Seite gehört zu welchem Lied (`owners[]`). Genau das nutzt `useSetlistPages` für den
 * durchgehenden Seitenstrom – stimmt die Zuordnung nicht, landen Anmerkungen auf der falschen Seite.
 */
function song(over: Partial<SetlistSong> & { chordpro: string }): SetlistSong {
  return {
    id: 1,
    arrangementId: 1,
    title: 'Testlied',
    author: 'Autor',
    originalKey: 'C',
    targetKey: 'C',
    bpm: null,
    timeSig: null,
    ccli: null,
    versions: [],
    documents: [],
    ...over,
  };
}

/** ChordPro mit `n` Textzeilen in einem Vers – zum Erzwingen von Umbrüchen. */
function longSong(lines: number, title = 'Langes Lied'): SetlistSong {
  const body = Array.from({ length: lines }, (_, i) => `[C]Zeile ${i} mit [G]Text`).join('\n');
  return song({
    title,
    chordpro: `{title: ${title}}\n{start_of_verse}\n${body}\n{end_of_verse}\n`,
  });
}

const SHORT = song({
  chordpro:
    '{title: Kurz}\n{start_of_verse}\n[C]Hallo [G]Welt\n[Am]Zweite [F]Zeile\n{end_of_verse}\n',
});

describe('generateChordPdf – Seitenaufteilung', () => {
  it('ein kurzes Lied passt auf eine Seite', () => {
    expect(generateChordPdf(SHORT).getNumberOfPages()).toBe(1);
  });

  it('ein sehr langes Lied bricht auf mehrere Seiten um', () => {
    expect(generateChordPdf(longSong(400)).getNumberOfPages()).toBeGreaterThan(1);
  });

  it('zwei Spalten brauchen weniger Seiten als eine', () => {
    const lang = longSong(120);
    const eine = generateChordPdf(lang, { cols: 1 }).getNumberOfPages();
    const zwei = generateChordPdf(lang, { cols: 2 }).getNumberOfPages();
    expect(zwei).toBeLessThan(eine);
  });

  it('größere Schrift braucht mehr (nie weniger) Seiten', () => {
    const lang = longSong(120);
    const klein = generateChordPdf(lang, { fontPt: 9 }).getNumberOfPages();
    const gross = generateChordPdf(lang, { fontPt: 16 }).getNumberOfPages();
    expect(gross).toBeGreaterThanOrEqual(klein);
  });

  it('„Nur Text" braucht nie mehr Seiten als mit Akkorden (Akkordzeilen entfallen)', () => {
    const lang = longSong(120);
    const mit = generateChordPdf(lang, { lyricsOnly: false }).getNumberOfPages();
    const ohne = generateChordPdf(lang, { lyricsOnly: true }).getNumberOfPages();
    expect(ohne).toBeLessThanOrEqual(mit);
  });

  it('leeres ChordPro erzeugt trotzdem eine gültige Seite (kein Absturz)', () => {
    expect(generateChordPdf(song({ chordpro: '' })).getNumberOfPages()).toBe(1);
  });

  it('SongSelect-Dialekt (comment-Abschnitte, optionale/Bass-Akkorde) läuft durch', () => {
    const s = song({
      chordpro:
        '{comment: Vers 1}\n[(E)]Optional [E/G#]Bass [C]normal\n{comment: Refrain}\n[G]Zeile\n',
    });
    expect(generateChordPdf(s).getNumberOfPages()).toBe(1);
  });

  it('in ein vorhandenes Dokument schreiben hängt an, statt neu zu beginnen', () => {
    const doc = generateChordPdf(SHORT);
    const vorher = doc.getNumberOfPages();
    generateChordPdf(longSong(400), {}, doc);
    expect(doc.getNumberOfPages()).toBeGreaterThan(vorher);
  });
});

describe('generateSetlistPdf – mehrere Lieder', () => {
  it('jedes weitere Lied beginnt auf einer neuen Seite', () => {
    const doc = generateSetlistPdf([SHORT, SHORT, SHORT], () => ({}));
    expect(doc.getNumberOfPages()).toBe(3);
  });
});

describe('generateSetlistPdfWithOwners – Seiten-Zuordnung', () => {
  it('liefert für JEDE Seite genau einen Besitzer', () => {
    const { doc, owners } = generateSetlistPdfWithOwners(
      [
        { ...longSong(400), id: 10 },
        { ...SHORT, id: 20 },
      ],
      () => ({}),
    );
    expect(owners).toHaveLength(doc.getNumberOfPages());
  });

  it('ordnet die Seiten dem richtigen Lied zu und zählt die Lied-Seite mit', () => {
    const lang = { ...longSong(400), id: 10 };
    const kurz = { ...SHORT, id: 20 };
    const { owners } = generateSetlistPdfWithOwners([lang, kurz], () => ({}));

    const erste = owners.filter((o) => o.songId === 10);
    const zweite = owners.filter((o) => o.songId === 20);
    expect(erste.length).toBeGreaterThan(1); // langes Lied belegt mehrere Seiten
    expect(zweite).toHaveLength(1);
    // localPage zählt innerhalb des Lieds bei 0 los und lückenlos hoch.
    expect(erste.map((o) => o.localPage)).toEqual(erste.map((_, i) => i));
    expect(zweite[0].localPage).toBe(0);
    // Die Seiten des zweiten Lieds kommen NACH denen des ersten.
    expect(owners.findIndex((o) => o.songId === 20)).toBe(erste.length);
  });

  it('übernimmt den Versions-Schlüssel (steuert die versionsbezogenen Anmerkungen)', () => {
    const { owners } = generateSetlistPdfWithOwners(
      [
        { ...SHORT, id: 1, versionKey: 'akustik' },
        { ...SHORT, id: 2 }, // ohne Angabe → 'original'
      ],
      () => ({}),
    );
    expect(owners.find((o) => o.songId === 1)?.versionKey).toBe('akustik');
    expect(owners.find((o) => o.songId === 2)?.versionKey).toBe('original');
  });

  it('songIdx zeigt auf die Position im Ablauf', () => {
    const { owners } = generateSetlistPdfWithOwners(
      [
        { ...SHORT, id: 7 },
        { ...SHORT, id: 8 },
        { ...SHORT, id: 9 },
      ],
      () => ({}),
    );
    expect(owners.map((o) => o.songIdx)).toEqual([0, 1, 2]);
  });

  it('leere Liste ergibt keine Besitzer', () => {
    expect(generateSetlistPdfWithOwners([], () => ({})).owners).toEqual([]);
  });
});

/**
 * #236: `{title: …}` im ChordPro wurde auf dem Blatt ignoriert – nur die Editor-Vorschau las es.
 * Der Kopf ist jetzt eine reine Funktion, damit die Regel prüfbar ist, ohne das PDF-Binary zu
 * zerlegen.
 */
describe('chartHead – Titel/Autor des Blatts', () => {
  it('{title} aus dem Text schlägt den ChurchTools-Liednamen', () => {
    const s = song({
      title: 'Mottosong AC26',
      chordpro: '{title: Mottosong AC26 - Auf dich will ich bauen}\n[C]Text\n',
    });
    expect(chartHead(s).title).toBe('Mottosong AC26 - Auf dich will ich bauen');
  });

  it('ohne {title} bleibt der ChurchTools-Liedname stehen', () => {
    expect(chartHead(song({ title: 'Nur CT', chordpro: '[C]Text\n' })).title).toBe('Nur CT');
  });

  it('ein leeres {title: } ersetzt den Liednamen NICHT durch nichts', () => {
    expect(chartHead(song({ title: 'Nur CT', chordpro: '{title: }\n[C]Text\n' })).title).toBe(
      'Nur CT',
    );
  });

  it('{artist} schlägt den ChurchTools-Autor, sonst bleibt dieser', () => {
    const mit = song({ author: 'CT-Autor', chordpro: '{artist: Echter Autor}\n[C]Text\n' });
    const ohne = song({ author: 'CT-Autor', chordpro: '[C]Text\n' });
    expect(chartHead(mit).author).toBe('Echter Autor');
    expect(chartHead(ohne).author).toBe('CT-Autor');
  });

  it('eine Version mit eigenem {title} bestimmt den Kopf ihres Blatts', () => {
    // Das ist der Fall, den der Server allein NICHT abdecken kann: er leitet den Titel aus dem
    // Original ab, angezeigt wird aber der Versionstext.
    const original = song({ title: 'Lied', chordpro: '{title: Lied lang}\n[C]Text\n' });
    const version = { ...original, chordpro: '{title: Lied – Akustik}\n[C]Text\n' };
    expect(chartHead(original).title).toBe('Lied lang');
    expect(chartHead(version).title).toBe('Lied – Akustik');
  });
});
