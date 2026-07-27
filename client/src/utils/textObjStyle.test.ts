import { describe, it, expect } from 'vitest';
import { textObjStyle } from './textObjStyle';
import type { PageTextObj } from '../hooks/usePageDraw';

/**
 * #193: Dieser Stil wird an DREI Stellen verwendet – Live-Ansicht, angesehene fremde Ebene und der
 * Slide-Streifen beim Blättern. Läuft er auseinander, springt der Text genau im Moment des
 * Blätterns (#113). Die Funktion ist die einzige Quelle; hier steht, worauf man sich verlassen darf.
 */
function obj(over: Partial<PageTextObj> = {}): PageTextObj {
  return { id: 1, fx: 0.25, fy: 0.5, text: 'Hallo', color: '#ff0000', sizeCqh: 2, ...over };
}

describe('textObjStyle', () => {
  it('rechnet die Position in Prozent der Seite um', () => {
    const s = textObjStyle(obj({ fx: 0.25, fy: 0.5 }));
    expect(s.left).toBe('25%');
    expect(s.top).toBe('50%');
  });

  it('bindet die Schriftgröße an die Seitenhöhe (cqh) – nicht an die Bildschirmgröße', () => {
    expect(textObjStyle(obj({ sizeCqh: 3.5 })).fontSize).toBe('3.5cqh');
  });

  it('übernimmt die Farbe des Textobjekts', () => {
    expect(textObjStyle(obj({ color: '#0061A1' })).color).toBe('#0061A1');
  });

  it('Bestandstexte OHNE bold-Feld bleiben fett (sie sahen immer so aus)', () => {
    expect(textObjStyle(obj()).fontWeight).toBe(700);
  });

  it('ausdrücklich nicht-fett bleibt nicht-fett (neuer Standard)', () => {
    expect(textObjStyle(obj({ bold: false })).fontWeight).toBe(400);
    expect(textObjStyle(obj({ bold: true })).fontWeight).toBe(700);
  });

  it('kursiv / unterstrichen nur, wenn gesetzt', () => {
    expect(textObjStyle(obj()).fontStyle).toBe('normal');
    expect(textObjStyle(obj()).textDecoration).toBe('none');
    expect(textObjStyle(obj({ italic: true })).fontStyle).toBe('italic');
    expect(textObjStyle(obj({ underline: true })).textDecoration).toBe('underline');
  });

  it('Ausrichtung: Standard mittig, sonst der gesetzte Wert', () => {
    expect(textObjStyle(obj()).textAlign).toBe('center');
    expect(textObjStyle(obj({ align: 'left' })).textAlign).toBe('left');
  });
});
