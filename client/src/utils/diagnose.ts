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

/**
 * Ist die Diagnose eingeschaltet? Einmal beim Laden entschieden.
 *
 * `?diag=zoom` schaltet ein UND merkt es sich. Der Grund: Die App wechselt ihre Ansichten selbst,
 * und ein Aufruf mit Parameter kann dabei verloren gehen – dann stünde der Nutzer vor einer Seite
 * ohne Protokoll und wüsste nicht, ob der Schalter fehlte oder nichts passiert ist. Einmal
 * eingeschaltet, bleibt es bis `?diag=aus`.
 */
function schalter(): boolean {
  if (typeof location === 'undefined') return false;
  const p = new URLSearchParams(location.search).get('diag');
  try {
    if (p === 'zoom') localStorage.setItem('worship:diag', 'zoom');
    if (p === 'aus') localStorage.removeItem('worship:diag');
    return localStorage.getItem('worship:diag') === 'zoom';
  } catch {
    // Privater Modus o. Ä. – dann gilt nur der Parameter dieses Aufrufs.
    return p === 'zoom';
  }
}

export const diagAn = schalter();

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
