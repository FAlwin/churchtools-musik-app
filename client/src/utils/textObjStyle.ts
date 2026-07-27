import type { CSSProperties } from 'react';
import type { PageTextObj, TextStyle } from '../hooks/usePageDraw';

/**
 * Darstellung eines Textobjekts auf einer Seite (#193).
 *
 * Warum zentral: Diese Regeln standen **dreimal** fast gleich im Code – Live-Ansicht, angesehene
 * fremde Ebene und der Slide-Streifen beim Blättern. Genau dort ist Drift teuer: Weicht der
 * Streifen von der Live-Ansicht ab, springt der Text im Moment des Blätterns sichtbar und blinkt
 * (#113 – dort war es der CSS-Default 700 gegen echtes Gewicht 400).
 *
 * `bold` fehlt bei Bestandstexten – die waren immer fett, deshalb Fallback `true`. Neue Texte
 * setzen das Feld ausdrücklich (`DEFAULT_TEXT_STYLE` ist nicht fett).
 */
export function textObjStyle(o: PageTextObj): CSSProperties {
  return {
    left: `${o.fx * 100}%`,
    top: `${o.fy * 100}%`,
    fontSize: `${o.sizeCqh}cqh`,
    color: o.color,
    fontWeight: (o.bold ?? true) ? 700 : 400,
    fontStyle: o.italic ? 'italic' : 'normal',
    textDecoration: o.underline ? 'underline' : 'none',
    textAlign: o.align ?? 'center',
  };
}

/**
 * Der Format-Zustand eines vorhandenen Textes (#199).
 *
 * Zweiter Abnehmer derselben `bold ?? true`-Regel: Die Werkzeugleiste zeigt damit an, wie der
 * AUSGEWÄHLTE Text formatiert ist, und die Inline-Eingabe übernimmt beim Bearbeiten seinen Stil.
 * Liefe das auseinander, sprängen Knöpfe und Darstellung auseinander.
 */
export function textStyleOf(o: PageTextObj): TextStyle {
  return {
    bold: o.bold ?? true,
    italic: !!o.italic,
    underline: !!o.underline,
    align: o.align ?? 'center',
  };
}
