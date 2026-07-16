// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  levelPagePrefix,
  hasStoredNotesForLevel,
  levelsUnderNamespace,
  levelKeyOf,
  OWN_DRAW_PREFIX,
} from './annotationKeys';

const NS = 'worship_teamview_';

beforeEach(() => localStorage.clear());

describe('levelPagePrefix / levelKeyOf', () => {
  it('baut den Ebenen-Präfix mit und ohne _lyr', () => {
    expect(levelPagePrefix(7, 'orig', false)).toBe('song7_vorig_');
    expect(levelPagePrefix(7, 'orig', true)).toBe('song7_vorig_lyr_');
  });
  it('levelKeyOf unterscheidet Darstellungsart', () => {
    expect(levelKeyOf({ versionKey: 'orig', lyr: false })).toBe('orig|0');
    expect(levelKeyOf({ versionKey: 'orig', lyr: true })).toBe('orig|1');
  });
});

describe('hasStoredNotesForLevel', () => {
  it('true bei nicht-leeren Strichen/Texten, false bei leer/fehlend', () => {
    expect(hasStoredNotesForLevel(1, 'orig', false)).toBe(false);
    localStorage.setItem(`${OWN_DRAW_PREFIX}song1_vorig_0_text`, '[]');
    expect(hasStoredNotesForLevel(1, 'orig', false)).toBe(false); // leer zählt nicht
    localStorage.setItem(`${OWN_DRAW_PREFIX}song1_vorig_0`, 'data:image/png;base64,AAAA');
    expect(hasStoredNotesForLevel(1, 'orig', false)).toBe(true);
  });
  it('trennt Darstellungsarten und ignoriert Zoom-Suffixe', () => {
    localStorage.setItem(`${OWN_DRAW_PREFIX}song1_vorig_lyr_0`, 'x');
    expect(hasStoredNotesForLevel(1, 'orig', true)).toBe(true);
    expect(hasStoredNotesForLevel(1, 'orig', false)).toBe(false);
    // Zoom-Schlüssel derselben Ebene darf NICHT als Anmerkung zählen.
    localStorage.clear();
    localStorage.setItem(`${OWN_DRAW_PREFIX}song1_vorig_0_dlarge2`, '{"scale":2}');
    expect(hasStoredNotesForLevel(1, 'orig', false)).toBe(false);
  });
});

describe('levelsUnderNamespace', () => {
  it('gruppiert Seiten je Ebene, sortiert, aus Strichen und _text', () => {
    localStorage.setItem(`${NS}song1_vorig_2`, 'x');
    localStorage.setItem(`${NS}song1_vorig_0_text`, '[{}]');
    localStorage.setItem(`${NS}song1_vorig_lyr_1`, 'x');
    localStorage.setItem('fremder_key', 'x'); // ignoriert
    const levels = levelsUnderNamespace(NS);
    const chords = levels.find((l) => !l.lyr);
    const lyrics = levels.find((l) => l.lyr);
    expect(chords).toEqual({ versionKey: 'orig', lyr: false, pages: [0, 2] });
    expect(lyrics).toEqual({ versionKey: 'orig', lyr: true, pages: [1] });
  });
});
