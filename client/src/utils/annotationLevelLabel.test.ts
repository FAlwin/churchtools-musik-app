import { describe, it, expect } from 'vitest';
import { anzeigeName, beschreibeEbene } from './annotationLevelLabel';

/**
 * Die Benennung einer Anmerkungs-Ebene – gemeldet von Alwin als „ich weiß nicht genau, was was ist".
 *
 * Der eigentliche Wert dieser Tests liegt im letzten Block: Auswahl und Streifen müssen **dieselben
 * Wörter** benutzen. Sie standen vorher als zwei getrennte Formulierungen im Code, und genau daran
 * ist die Angabe auseinandergelaufen (das Arrangement kam in keiner von beiden vor).
 */
const NAMEN = {
  versionName: (key: string) => (key === 'akustik' ? 'Akustik' : 'Original'),
  arrangementName: (id: number | null) =>
    id === null ? 'Ohne Arrangement' : id === 152 ? 'Test' : 'Standard-Arrangement',
};
/** Ein Lied mit nur EINEM Arrangement: Dann wird es bewusst nicht genannt. */
const OHNE_ARR = { ...NAMEN, arrangementName: () => null };

describe('beschreibeEbene – jeder Teil sagt, was er ist', () => {
  it('benennt Arrangement, Version und Anzeige mit den Wörtern des Lied-Menüs', () => {
    // Dieselben drei Begriffe stehen im Lied-Menü über den Abschnitten. Ein eigenes Vokabular an
    // dieser Stelle wäre eine zweite Sprache für dieselbe Sache.
    const b = beschreibeEbene({ versionKey: 'original', lyr: false, arrangementId: 152 }, NAMEN);
    expect(b.arrangement).toBe('Arrangement: Test');
    expect(b.details).toBe('Version: Original · Anzeige: Akkorde & Text');
  });

  it('nennt „Nur Text" als Anzeige, nicht als Version', () => {
    const b = beschreibeEbene({ versionKey: 'akustik', lyr: true, arrangementId: 151 }, NAMEN);
    expect(b.details).toBe('Version: Akustik · Anzeige: Nur Text');
  });

  it('lässt das Arrangement weg, wenn das Lied nur eines hat', () => {
    const b = beschreibeEbene(
      { versionKey: 'original', lyr: false, arrangementId: null },
      OHNE_ARR,
    );
    expect(b.arrangement).toBeNull();
    expect(b.einzeilig).toBe('Version: Original · Anzeige: Akkorde & Text');
  });

  it('benennt Bestandsnotizen ohne Segment, statt sie namenlos zu lassen', () => {
    const b = beschreibeEbene({ versionKey: 'original', lyr: false, arrangementId: null }, NAMEN);
    expect(b.arrangement).toBe('Arrangement: Ohne Arrangement');
  });
});

describe('beschreibeEbene – Auswahl und Streifen sagen dasselbe', () => {
  it('die einzeilige Fassung enthält Wort für Wort, was die zweizeilige zeigt', () => {
    // Das ist der Grund für diese Datei: Vorher formulierten Auswahl und Streifen jeder für sich.
    const ebene = { versionKey: 'akustik', lyr: true, arrangementId: 152 };
    const b = beschreibeEbene(ebene, NAMEN);
    expect(b.einzeilig).toBe(`${b.arrangement} · ${b.details}`);
  });

  it('ohne Arrangement bleibt die einzeilige Fassung genau die Detailzeile', () => {
    // Kein führendes „ · “, wenn der erste Teil fehlt – sonst begänne der Streifen mit einem Punkt.
    const b = beschreibeEbene(
      { versionKey: 'original', lyr: false, arrangementId: null },
      OHNE_ARR,
    );
    expect(b.einzeilig).toBe(b.details);
    expect(b.einzeilig.startsWith(' ·')).toBe(false);
  });
});

describe('anzeigeName', () => {
  it('nennt die beiden Darstellungsarten wie das Lied-Menü', () => {
    expect(anzeigeName(false)).toBe('Akkorde & Text');
    expect(anzeigeName(true)).toBe('Nur Text');
  });
});
