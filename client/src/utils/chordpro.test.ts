import { describe, it, expect } from 'vitest';
import { parseChordPro, parseLine, parseMetadata } from './chordpro';

describe('parseLine', () => {
  it('gibt reinen Text ohne Akkorde als ein Paar zurück', () => {
    expect(parseLine('nur Text')).toEqual([{ chord: null, text: 'nur Text' }]);
  });

  it('trennt führenden Text vom ersten Akkord', () => {
    expect(parseLine('Hallo [C]Welt [G]nun')).toEqual([
      { chord: null, text: 'Hallo ' },
      { chord: 'C', text: 'Welt ' },
      { chord: 'G', text: 'nun' },
    ]);
  });

  it('behandelt einen Akkord am Zeilenanfang ohne führenden Text', () => {
    expect(parseLine('[C]Start')).toEqual([{ chord: 'C', text: 'Start' }]);
  });

  it('behandelt leere Klammern als chord=null', () => {
    expect(parseLine('[]leer')).toEqual([{ chord: null, text: 'leer' }]);
  });
});

describe('parseChordPro – Standard-Dialekt', () => {
  it('liest start_of/end_of-Blöcke mit Label', () => {
    const sections = parseChordPro('{start_of_verse: Strophe 1}\nText [C]hier\n{end_of_verse}');
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ type: 'verse', label: 'Strophe 1' });
    expect(sections[0].lines).toEqual(['Text [C]hier']);
  });

  it('liest die Kurzform {chorus: 2}', () => {
    const sections = parseChordPro('{chorus: 2}\nRefrain-Zeile');
    expect(sections[0]).toMatchObject({ type: 'chorus', label: '2' });
  });

  it('normalisiert Bindestriche im Typ (pre-chorus -> pre_chorus)', () => {
    const sections = parseChordPro('{pre-chorus}\nZeile');
    expect(sections[0].type).toBe('pre_chorus');
  });
});

describe('parseChordPro – SongSelect-Dialekt', () => {
  it('leitet aus {comment: …} den Abschnittstyp ab', () => {
    const sections = parseChordPro('{comment: Vers 1}\nZeile');
    expect(sections[0]).toMatchObject({ type: 'verse', label: 'Vers 1' });
  });

  it('erkennt deutsche und englische Labels', () => {
    expect(parseChordPro('{comment: Refrain}\nx')[0].type).toBe('chorus');
    expect(parseChordPro('{comment: Bridge}\nx')[0].type).toBe('bridge');
    expect(parseChordPro('{comment: Pre-Chorus}\nx')[0].type).toBe('pre_chorus');
  });
});

describe('parseChordPro – Sonderfälle', () => {
  it('öffnet einen impliziten Vers ohne Abschnitts-Direktive', () => {
    const sections = parseChordPro('Einfach Text\nZweite Zeile');
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ type: 'verse', label: '' });
    expect(sections[0].lines).toEqual(['Einfach Text', 'Zweite Zeile']);
  });

  it('überspringt Metadaten-Direktiven', () => {
    const sections = parseChordPro('{title: Lied}\n{key: G}\nInhalt');
    expect(sections).toHaveLength(1);
    expect(sections[0].lines).toEqual(['Inhalt']);
  });

  it('verwirft leere Abschnitte und entfernt nachlaufende Leerzeilen', () => {
    const sections = parseChordPro('{start_of_verse}\n{end_of_verse}\n{chorus}\nZeile\n\n');
    expect(sections).toHaveLength(1);
    expect(sections[0].type).toBe('chorus');
    expect(sections[0].lines).toEqual(['Zeile']);
  });
});

describe('parseMetadata', () => {
  it('liest bekannte Metadaten-Felder', () => {
    const meta = parseMetadata('{title: Amazing Grace}\n{key: G}\n{ccli: 12345}');
    expect(meta).toEqual({ title: 'Amazing Grace', key: 'G', ccli: '12345' });
  });

  it('ignoriert unbekannte Direktiven', () => {
    const meta = parseMetadata('{foo: bar}\n{title: X}');
    expect(meta).toEqual({ title: 'X' });
  });
});
