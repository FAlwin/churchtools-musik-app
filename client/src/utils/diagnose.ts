/**
 * Diagnose-Protokoll für den Zoom nach dem Vollbild-Umschalten (#319/#320).
 *
 * **Ausdrücklich vorübergehend.** Es beantwortet EINE Frage, die sich hier nicht messen lässt:
 * Warum kommt das Einpassen bei Alwin 5–10 Sekunden zu spät, während es in der Demo-Ansicht in
 * 100 ms passiert? Drei Vermutungen waren falsch (gespeicherter Zoom, Pixel-Deckel, Gestensperre) –
 * jede davon ist gemessen widerlegt. Der Unterschied liegt in der Umgebung: Dort werden die Seiten
 * aus ChurchTools neu aufgebaut, hier stehen sie sofort.
 *
 * **Nur mit `?diag=zoom` in der Adresse.** Ohne den Schalter passiert nichts und es wird auch nichts
 * angezeigt – niemand im Gottesdienst bekommt das zu sehen. Nach der Klärung fliegt die Datei
 * samt ihrer Aufrufe wieder raus; sie ist keine Einrichtung auf Dauer.
 */

/** Ist die Diagnose eingeschaltet? Einmal beim Laden entschieden. */
export const diagAn =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('diag') === 'zoom';

export interface DiagZeile {
  /** Millisekunden seit dem Einschalten – die ZEITABSTÄNDE sind die eigentliche Auskunft. */
  ms: number;
  text: string;
}

const zeilen: DiagZeile[] = [];
let hoerer: (() => void) | null = null;
const start = typeof performance !== 'undefined' ? performance.now() : 0;

/**
 * Einen Vorgang festhalten.
 *
 * Bewusst ohne Aufräumen und ohne Deckel nach oben: Der Lauf dauert eine halbe Minute, und ein
 * abgeschnittenes Protokoll wäre genau dann wertlos, wenn der interessante Teil am Anfang stand.
 */
export function diag(text: string): void {
  if (!diagAn) return;
  zeilen.push({ ms: Math.round(performance.now() - start), text });
  hoerer?.();
}

export function diagZeilen(): DiagZeile[] {
  return zeilen;
}

export function diagHoeren(fn: (() => void) | null): void {
  hoerer = fn;
}
