import { describe, it, expect } from 'vitest';
import {
  transposeChord,
  getSemitoneOffset,
  shiftKey,
  ALL_KEYS_MAJOR,
  ALL_KEYS_MINOR,
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
