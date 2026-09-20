import { describe, it, expect } from 'vitest';
import {
  transposeChord,
  getSemitoneOffset,
  shiftKey,
  ALL_KEYS_MAJOR,
  ALL_KEYS_MINOR,
  transposeChordpro,
  mitTonart,
} from './transpose';

describe('transposeChord', () => {
  it('transponiert einen einfachen Dur-Akkord', () => {
    expect(transposeChord('C', 2)).toBe('D');
    expect(transposeChord('G', 5)).toBe('C');
  });

  it('lässt bei 0 Halbtönen den Akkord unverändert', () => {
    expect(transposeChord('Am', 0)).toBe('Am');
  });

  it('erhält Suffixe wie m7 / sus4', () => {
    expect(transposeChord('Cm7', 2)).toBe('Dm7');
    expect(transposeChord('Dsus4', 2)).toBe('Esus4');
  });

  it('transponiert Bass-Akkorde (Root und Bass)', () => {
    expect(transposeChord('E/G#', 1)).toBe('F/A');
    expect(transposeChord('C/E', 5)).toBe('F/A');
  });

  it('nutzt b-Schreibweise, wenn flat=true', () => {
    expect(transposeChord('C', 1, true)).toBe('Db');
    expect(transposeChord('C', 1, false)).toBe('C#');
    expect(transposeChord('C/E', 1, true)).toBe('Db/F');
  });

  it('behandelt optionale Akkorde in Klammern (SongSelect)', () => {
    expect(transposeChord('(E)', 2)).toBe('(F#)');
    expect(transposeChord('(Am7)', 0)).toBe('(Am7)');
  });

  it('wickelt über die Oktave hinaus korrekt um', () => {
    expect(transposeChord('B', 1)).toBe('C');
    expect(transposeChord('A', 3)).toBe('C');
  });

  it('lässt leere Eingaben und unbekannte Roots unverändert', () => {
    expect(transposeChord('', 2)).toBe('');
    expect(transposeChord('   ', 2)).toBe('   ');
    // 'H' ist deutsche Notation, nicht im chromatischen Set -> unverändert
    expect(transposeChord('H', 2)).toBe('H');
  });
});

describe('getSemitoneOffset', () => {
  it('berechnet den Halbton-Abstand zweier Tonarten', () => {
    expect(getSemitoneOffset('C', 'D')).toBe(2);
    expect(getSemitoneOffset('A', 'C')).toBe(3);
  });

  it('wickelt aufwärts um (kein negativer Abstand)', () => {
    expect(getSemitoneOffset('B', 'C')).toBe(1);
    expect(getSemitoneOffset('G', 'C')).toBe(5);
  });

  it('ignoriert das Moll-Suffix bei der Differenz', () => {
    expect(getSemitoneOffset('Am', 'Cm')).toBe(3);
  });

  it('gibt 0 bei unbekannter Tonart zurück', () => {
    expect(getSemitoneOffset('H', 'C')).toBe(0);
  });
});

describe('shiftKey', () => {
  it('verschiebt eine Dur-Tonart', () => {
    expect(shiftKey('C', 2)).toBe('D');
  });

  it('erhält das Moll-Suffix', () => {
    expect(shiftKey('Am', 3)).toBe('Cm');
  });

  it('lässt unbekannte Tonarten unverändert', () => {
    expect(shiftKey('H', 2)).toBe('H');
  });
});

describe('Tonart-Listen', () => {
  it('liefert 12 Dur- und 12 Moll-Tonarten', () => {
    expect(ALL_KEYS_MAJOR).toHaveLength(12);
    expect(ALL_KEYS_MINOR).toHaveLength(12);
    expect(ALL_KEYS_MINOR.every((k) => k.endsWith('m'))).toBe(true);
  });
});

/**
 * #398: Der Editor zeigt den Text in der Tonart des Blatts – dafür muss ein GANZER Text
 * transponiert werden, nicht nur ein Akkord bei der Anzeige. Die Regel für den einzelnen Akkord
 * bleibt `transposeChord`; hier geht es darum, WAS angefasst wird und was nicht.
 */
describe('transposeChordpro', () => {
  it('verschiebt alle Akkorde in eckigen Klammern', () => {
    expect(transposeChordpro('[G]Herr, [D]du bist [Em]gut', 2)).toBe(
      '[A]Herr, [E]du bist [F#m]gut',
    );
  });

  it('zieht die {key}-Zeile mit – Kopf und Akkorde dürfen nie auseinanderlaufen', () => {
    expect(transposeChordpro('{key: G}\n[G]Text', 7)).toBe('{key: D}\n[D]Text');
  });

  it('lässt andere Direktiven in Ruhe – in einem Kommentar steht kein Akkord', () => {
    const t = '{title: Am Anfang}\n{comment: Bridge}\n[A]Text';
    expect(transposeChordpro(t, 2)).toBe('{title: Am Anfang}\n{comment: Bridge}\n[B]Text');
  });

  it('gibt bei 0 Halbtönen den Text BUCHSTÄBLICH zurück – keine Schreibweise wird angefasst', () => {
    const t = '{key: Bb}\n[Bb]Text [Eb/G]mehr';
    expect(transposeChordpro(t, 0)).toBe(t);
  });

  it('nimmt Bass-Töne und Klammer-Akkorde mit – dieselbe Regel wie die Anzeige', () => {
    expect(transposeChordpro('[D/F#]Text [(A)]leise', 2)).toBe('[E/G#]Text [(B)]leise');
  });

  it('verträgt eine leere {key: }-Zeile, ohne sie zu erfinden', () => {
    expect(transposeChordpro('{key: }\n[C]Text', 2)).toBe('{key: }\n[D]Text');
  });
});

/**
 * Eine gespeicherte Version muss ihre Tonart SELBST nennen (#398): Ohne `{key}`-Zeile nähme die App
 * die Tonart des Originals an – genau der Fehler, der Alwin einen Abend gekostet hat.
 */
describe('mitTonart', () => {
  it('ersetzt eine vorhandene {key}-Zeile', () => {
    expect(mitTonart('{title: X}\n{key: G}\n[G]Text', 'D')).toBe('{title: X}\n{key: D}\n[G]Text');
  });

  it('ergänzt die Zeile hinter dem Kopfblock, wenn keine da ist', () => {
    expect(mitTonart('{title: X}\n{artist: Y}\n[G]Text', 'D')).toBe(
      '{title: X}\n{artist: Y}\n{key: D}\n[G]Text',
    );
  });

  it('setzt sie ganz oben, wenn es keinen Kopfblock gibt', () => {
    expect(mitTonart('[G]Text', 'D')).toBe('{key: D}\n[G]Text');
  });

  it('erfindet keine zweite Zeile, wenn schon eine da ist – auch weiter unten', () => {
    const r = mitTonart('[G]Text\n{key: G}', 'D');
    expect(r.match(/\{key/g)).toHaveLength(1);
    expect(r).toContain('{key: D}');
  });
});
