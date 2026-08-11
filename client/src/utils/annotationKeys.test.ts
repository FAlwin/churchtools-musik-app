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
    expect(levelPagePrefix(7, 'orig', false, null)).toBe('song7_vorig_');
    expect(levelPagePrefix(7, 'orig', true, null)).toBe('song7_vorig_lyr_');
  });
  it('levelKeyOf unterscheidet Darstellungsart', () => {
    expect(levelKeyOf({ versionKey: 'orig', lyr: false, arrangementId: null })).toBe('|orig|0');
    expect(levelKeyOf({ versionKey: 'orig', lyr: true, arrangementId: null })).toBe('|orig|1');
  });
});

describe('hasStoredNotesForLevel', () => {
  it('true bei nicht-leeren Strichen/Texten, false bei leer/fehlend', () => {
    expect(hasStoredNotesForLevel(1, 'orig', false, null)).toBe(false);
    localStorage.setItem(`${OWN_DRAW_PREFIX}song1_vorig_0_text`, '[]');
    expect(hasStoredNotesForLevel(1, 'orig', false, null)).toBe(false); // leer zählt nicht
    localStorage.setItem(`${OWN_DRAW_PREFIX}song1_vorig_0`, 'data:image/png;base64,AAAA');
    expect(hasStoredNotesForLevel(1, 'orig', false, null)).toBe(true);
  });
  it('trennt Darstellungsarten und ignoriert Zoom-Suffixe', () => {
    localStorage.setItem(`${OWN_DRAW_PREFIX}song1_vorig_lyr_0`, 'x');
    expect(hasStoredNotesForLevel(1, 'orig', true, null)).toBe(true);
    expect(hasStoredNotesForLevel(1, 'orig', false, null)).toBe(false);
    // Zoom-Schlüssel derselben Ebene darf NICHT als Anmerkung zählen.
    localStorage.clear();
    localStorage.setItem(`${OWN_DRAW_PREFIX}song1_vorig_0_dlarge2`, '{"scale":2}');
    expect(hasStoredNotesForLevel(1, 'orig', false, null)).toBe(false);
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
    expect(chords).toEqual({ versionKey: 'orig', lyr: false, arrangementId: null, pages: [0, 2] });
    expect(lyrics).toEqual({ versionKey: 'orig', lyr: true, arrangementId: null, pages: [1] });
  });

  it('trennt zwei Arrangements mit demselben Versionsnamen (#320, 3c)', () => {
    // Der Grund für den ganzen Schritt: Die ChordPro-Versionen liegen als Dateien IM Arrangement.
    // Zwei Arrangements können je eine „Akustik" haben – gleicher Versions-Schlüssel, anderes
    // Notenblatt. Verschmölzen sie hier zu einer Ebene, fände man die Striche des Kollegen nicht.
    localStorage.clear();
    localStorage.setItem(`${NS}song1_a45_vakustik_0`, 'x');
    localStorage.setItem(`${NS}song1_a46_vakustik_1`, 'x');
    const levels = levelsUnderNamespace(NS);
    expect(levels).toHaveLength(2);
    expect(levels.find((l) => l.arrangementId === 45)?.pages).toEqual([0]);
    expect(levels.find((l) => l.arrangementId === 46)?.pages).toEqual([1]);
  });

  it('hält Bestandsnotizen ohne Segment getrennt von arrangement-genauen', () => {
    localStorage.clear();
    localStorage.setItem(`${NS}song1_vakustik_0`, 'x');
    localStorage.setItem(`${NS}song1_a45_vakustik_0`, 'x');
    const levels = levelsUnderNamespace(NS);
    expect(levels).toHaveLength(2);
    expect(levels.some((l) => l.arrangementId === null)).toBe(true);
  });
});

describe('hasStoredNotesForLevel – der Stift-Marker findet arrangement-genaue Notizen', () => {
  it('findet Notizen, die MIT Arrangement gespeichert sind', () => {
    // Genau das ging nach #320 still verloren: Der Marker suchte unter `song1_vorig_`, gespeichert
    // wird aber `song1_a45_vorig_`. Der Stift verschwand – ohne Fehlermeldung, ohne dass ein Test
    // fiel. Aufgefallen erst beim Aufräumen, weil `levelPagePrefix` die Angabe nicht durchreichte.
    localStorage.setItem(`${OWN_DRAW_PREFIX}song1_a45_vorig_0`, '[[1,2]]');
    expect(hasStoredNotesForLevel(1, 'orig', false, 45)).toBe(true);
  });

  it('verwechselt zwei Arrangements nicht', () => {
    localStorage.setItem(`${OWN_DRAW_PREFIX}song1_a45_vorig_0`, '[[1,2]]');
    expect(hasStoredNotesForLevel(1, 'orig', false, 46)).toBe(false);
  });

  it('findet Bestandsnotizen ohne Arrangement weiterhin', () => {
    localStorage.setItem(`${OWN_DRAW_PREFIX}song1_vorig_0`, '[[1,2]]');
    expect(hasStoredNotesForLevel(1, 'orig', false, null)).toBe(true);
  });
});
