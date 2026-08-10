/**
 * Die Zeitrechnung des Tempo-Pulses (#145).
 *
 * Der Puls hilft beim Einzählen, wenn kein Schlagzeuger da ist. Zwei Dinge müssen stimmen, und
 * beide sind reine Rechnung – deshalb hier und nicht in der Komponente:
 *
 *  - **Er darf nicht auseinanderlaufen.** Ein `setInterval` sammelt bei jedem Tick den Fehler auf;
 *    nach zwei Minuten liegt der Puls hörbar daneben. Deshalb wird der Schlag IMMER aus der
 *    verstrichenen Zeit seit dem Start berechnet, nie hochgezählt. Ein verschluckter Frame
 *    verschiebt dann höchstens einen Schlag, statt alle folgenden.
 *  - **Er darf nicht zu schnell blinken.** Mehr als drei Blitze je Sekunde gelten als Auslöser für
 *    photosensitive Anfälle (WCAG 2.3.1). Bei sehr schnellen Liedern blinkt deshalb nur jeder
 *    zweite Schlag – musikalisch eine übliche Art, ein schnelles Stück zu fühlen.
 */

/** Höchste Blitzrate je Sekunde (WCAG 2.3.1). */
const MAX_FLASHES_PER_SECOND = 3;

/**
 * Plausibles Tempo – re-exportiert aus `@shared/tempo`, weil auch der SERVER den Bereich braucht:
 * Er prüft ihn, bevor er ein angetipptes Tempo nach ChurchTools schreibt. Die Zahlen stehen deshalb
 * bewusst nur EINMAL, jenseits der Prozessgrenze. Der Re-Export hier bleibt, damit die bestehenden
 * Importe (`bpmPulse`, `tapTempo`) nicht umgeschrieben werden müssen.
 */
export { MAX_BPM, MIN_BPM } from '@shared/tempo/index';
import { MAX_BPM, MIN_BPM } from '@shared/tempo/index';

/** Lässt sich aus diesem Tempo überhaupt ein sinnvoller Puls bauen? */
export function isPulsable(bpm: number | null | undefined): bpm is number {
  return typeof bpm === 'number' && Number.isFinite(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM;
}

/** Dauer eines Schlags in Millisekunden. */
export function msPerBeat(bpm: number): number {
  return 60_000 / bpm;
}

/**
 * Wie viele Schläge liegen zwischen zwei Blitzen? 1 (jeder Schlag) oder 2 (jeder zweite).
 *
 * Ab 180 bpm wären es mehr als drei Blitze je Sekunde – dann wird halbiert.
 */
export function beatsPerFlash(bpm: number): 1 | 2 {
  return bpm > MAX_FLASHES_PER_SECOND * 60 ? 2 : 1;
}

/**
 * Der wievielte BLITZ läuft nach `elapsedMs` seit dem Einschalten?
 *
 * Ändert sich der Rückgabewert, ist ein neuer Blitz fällig. Weil er aus der verstrichenen Zeit
 * folgt und nicht hochgezählt wird, bleibt er auch nach Minuten exakt am Tempo.
 */
export function flashIndexAt(elapsedMs: number, bpm: number): number {
  if (elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / (msPerBeat(bpm) * beatsPerFlash(bpm)));
}

/**
 * Welcher SCHLAG gehört zu diesem Blitz?
 *
 * Unterhalb von 180 bpm dasselbe; darüber wird nur jeder zweite Schlag geblitzt, dann ist der
 * dritte Blitz der sechste Schlag. Gebraucht wird die Unterscheidung für die Betonung: Ob die Eins
 * markiert wird, hängt am SCHLAG im Takt, nicht daran, der wievielte Blitz es war.
 *
 * **Bekannte Grenze:** Über 180 bpm in einer ungeraden Taktart (3/4) fallen geblitzte Schläge und
 * Taktanfänge nur bei jedem zweiten Takt zusammen – die Eins wird dann seltener markiert. Das ist
 * die Folge der Blitzgrenze aus WCAG 2.3.1 und in Kauf genommen: Ein 3/4-Stück jenseits von 180
 * fühlt man ohnehin in Takten und nicht in Schlägen.
 */
export function beatIndexOfFlash(flashIndex: number, bpm: number): number {
  return flashIndex * beatsPerFlash(bpm);
}
