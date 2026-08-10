import { describe, it, expect } from 'vitest';
import { ANNO_KEY_RE, levelPrefix, normalizeAnnoKey, songPageKey } from '@shared/keys/index';

/**
 * Die Schlüssel-Grammatik aus `@shared/keys` – **bislang ungeprüft**, obwohl an ihr hängt, auf
 * welcher Ebene ein gezeichneter Strich landet. Aufgefallen beim Einbau des Arrangement-Segments
 * (#320): Es gab keinen Test, der die Erweiterung hätte absichern können.
 *
 * Geprüft wird hier die Grammatik selbst, nicht ihre Verwendung: Was erzeugt wird, muss auch durch
 * das Prüfmuster kommen – sonst baut der Client Schlüssel, die der Server beim Konto-Sync
 * **stillschweigend verwirft**. Genau diese Klasse Fehler waren #215 und #250, und heute noch
 * einmal die Zählweise, die es nicht in die Namensliste geschafft hatte.
 */
describe('Grammatik: was erzeugt wird, muss auch gültig sein', () => {
  const faelle: { was: string; key: string }[] = [
    { was: 'ohne alles', key: songPageKey(12, 'original', false, 3) },
    { was: 'Nur Text', key: songPageKey(12, 'original', true, 3) },
    { was: 'mit Arrangement', key: songPageKey(12, 'original', false, 3, 45) },
    { was: 'Arrangement + Nur Text', key: songPageKey(12, 'akustik', true, 0, 45) },
    { was: 'Version mit Bindestrich', key: songPageKey(12, 'akustik-leise', false, 7, 45) },
    { was: 'Zoom-Layout hinten dran', key: songPageKey(12, 'original', false, 3, 45) + '_dlarge2' },
  ];

  for (const { was, key } of faelle) {
    it(`${was}: ${key}`, () => {
      expect(ANNO_KEY_RE.test(key)).toBe(true);
    });
  }
});

describe('Arrangement-Segment (#320)', () => {
  it('steht direkt hinter dem Lied, nicht am Ende', () => {
    // Hinten hängt beim Zoom schon das Layout-Segment. Zwei wandernde Enden wären eine Fehlerquelle
    // mehr – und das Prüfmuster müsste beide Reihenfolgen erlauben.
    expect(songPageKey(12, 'original', false, 3, 45)).toBe('song12_a45_voriginal_3');
  });

  it('fehlt es, entsteht GENAU der alte Schlüssel', () => {
    // Das ist die Zusage an den Bestand: Wer ohne Arrangement aufruft, bekommt, was er immer bekam.
    expect(songPageKey(12, 'original', false, 3)).toBe('song12_voriginal_3');
    expect(songPageKey(12, 'original', false, 3, null)).toBe('song12_voriginal_3');
    expect(songPageKey(12, 'original', false, 3, undefined)).toBe('song12_voriginal_3');
  });

  it('unterscheidet zwei Arrangements mit derselben Version', () => {
    // Der eigentliche Grund für das Segment: Die ChordPro-Versionen liegen als Dateien IM
    // Arrangement. Zwei Arrangements können je eine „Akustik" haben – gleicher Versions-Schlüssel,
    // anderes Notenblatt.
    expect(songPageKey(12, 'akustik', false, 3, 45)).not.toBe(
      songPageKey(12, 'akustik', false, 3, 46),
    );
  });

  it('der Ebenen-Präfix zieht mit', () => {
    expect(levelPrefix(12, 'original', false, 45)).toBe('song12_a45_voriginal_');
    expect(levelPrefix(12, 'original', false)).toBe('song12_voriginal_');
  });
});

describe('Grammatik: was NICHT durchkommen darf', () => {
  it('lehnt ein leeres oder unsinniges Arrangement ab', () => {
    for (const k of ['song12_a_voriginal_3', 'song12_ax_voriginal_3', 'song12_a45voriginal_3']) {
      expect(ANNO_KEY_RE.test(k), k).toBe(false);
    }
  });

  it('lehnt Dokument-Schlüssel weiter ab – die bleiben bewusst lokal', () => {
    expect(ANNO_KEY_RE.test('4711_2')).toBe(false);
  });

  it('lehnt Angehängtes ab, statt es durchzulassen', () => {
    expect(ANNO_KEY_RE.test('song12_a45_voriginal_3_muell')).toBe(false);
  });
});

describe('normalizeAnnoKey – Altbestand', () => {
  it('hebt versionslose Schlüssel weiterhin auf das aktuelle Schema', () => {
    expect(normalizeAnnoKey('song12_3')).toBe('song12_voriginal_3');
  });

  it('lässt einen Schlüssel MIT Arrangement unangetastet', () => {
    // Er ist bereits gültig – ihn zu „heben" würde das Segment verlieren.
    expect(normalizeAnnoKey('song12_a45_voriginal_3')).toBe('song12_a45_voriginal_3');
  });
});
