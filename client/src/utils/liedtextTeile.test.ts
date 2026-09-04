import { describe, it, expect } from 'vitest';
import { chordproZuTeile } from './liedtextTeile';

/**
 * Die Vorschau eigener Lieder mit Abschnitten (#379, 04.09.2026).
 *
 * Geprüft wird das, was den Unterschied zum gekürzten Anfang macht: Abschnitte mit Namen,
 * Zeilenumbrüche, keine Akkorde – und dass die Zerlegung dieselbe ist wie beim Blatt (beide
 * ChordPro-Dialekte).
 */
describe('chordproZuTeile', () => {
  it('Standard-Dialekt: Abschnitte mit Label, Akkorde raus, Zeilen bleiben', () => {
    const teile = chordproZuTeile(
      '{title: Treu}\n{start_of_verse: Vers 1}\n[D]Deine [G]Treue\n[A]trägt mich\n{end_of_verse}\n{start_of_chorus}\n[D]Treu bist [G]du\n{end_of_chorus}',
    );
    expect(teile).toEqual([
      { label: 'Vers 1', text: 'Deine Treue\nträgt mich' },
      { label: 'chorus', text: 'Treu bist du' },
    ]);
  });

  it('SongSelect-Dialekt: {comment: …} eröffnet einen Abschnitt', () => {
    const teile = chordproZuTeile(
      '{comment: Chorus 2}\n[G]Halleluja\n\n{comment: Bridge}\n[C]Komm',
    );
    expect(teile.map((t) => t.label)).toEqual(['Chorus 2', 'Bridge']);
    expect(teile[0].text).toBe('Halleluja');
  });

  it('ein Lied ohne Text (nur Direktiven) ergibt keine Abschnitte', () => {
    // Die Vorschau sagt dann „kein Liedtext" – statt eine leere Fläche zu zeigen.
    expect(chordproZuTeile('{title: Nur Titel}\n{key: D}')).toEqual([]);
  });

  it('Akkorde am Zeilenende hinterlassen keinen Leerraum', () => {
    const [t] = chordproZuTeile('{start_of_verse}\nWort [D]\n{end_of_verse}');
    expect(t.text).toBe('Wort');
  });
});
