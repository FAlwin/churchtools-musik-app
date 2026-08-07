/**
 * Die Rechnung hinter dem hörbaren Klick (#145 Folge-Wunsch).
 *
 * Getrennt vom Ton selbst, weil hier die Entscheidungen liegen, die man prüfen kann und muss:
 * **wie viele Schläge ein Takt hat**, **wann eingezählt fertig ist** und **welcher Schlag betont
 * wird**. Der Ton selbst ist nur Ausgabe.
 *
 * Die Taktart kommt aus ChurchTools (`{time:}` im ChordPro oder `beat` am Arrangement) und ist
 * damit alles andere als verlässlich – sie kann fehlen, „4/4", „4 / 4" oder Unsinn sein. Deshalb
 * fällt jede Ableitung hier auf etwas Brauchbares zurück, statt den Klick ausfallen zu lassen.
 */

/** Ohne brauchbare Angabe wird im Viervierteltakt gezählt – die mit Abstand häufigste Taktart. */
export const DEFAULT_BEATS_PER_BAR = 4;

/** So viele Takte wird eingezählt. Zwei sind die gängige Ansage („und eins, zwei, drei, vier"). */
export const COUNT_IN_BARS = 2;

/**
 * Schläge je Takt aus der Taktart-Angabe.
 *
 * Genommen wird der Zähler: „3/4" → 3. Zusammengesetzte Taktarten wie „6/8" ergeben damit 6 statt
 * der musikalisch üblichen 2 – bewusst so gelassen: Ein zu feiner Klick ist unangenehm, aber
 * verständlich; ein falsch geratener wäre schlimmer. Wer 6/8 in Zweiern fühlt, nimmt den Klick eben
 * als Achtel.
 */
export function beatsPerBar(timeSig: string | null | undefined): number {
  if (!timeSig) return DEFAULT_BEATS_PER_BAR;
  const m = /^\s*(\d{1,2})\s*\/\s*\d{1,2}\s*$/.exec(timeSig);
  if (!m) return DEFAULT_BEATS_PER_BAR;
  const zaehler = Number(m[1]);
  return zaehler >= 1 && zaehler <= 16 ? zaehler : DEFAULT_BEATS_PER_BAR;
}

/** Wie viele Schläge dauert das Einzählen? */
export function countInBeats(timeSig: string | null | undefined): number {
  return COUNT_IN_BARS * beatsPerBar(timeSig);
}

/**
 * Ist dieser Schlag die betonte Eins?
 *
 * Ohne Betonung ist ein Klick nur ein Ticken – erst sie sagt, wo der Takt anfängt, und genau darum
 * geht es beim Einzählen.
 */
export function isAccent(beatIndex: number, beatsProTakt: number): boolean {
  if (beatsProTakt <= 0) return false;
  return beatIndex % beatsProTakt === 0;
}

/** Zeitpunkt eines Schlags in SEKUNDEN seit dem Start (Einheit der Audio-Uhr). */
export function beatTimeSec(beatIndex: number, bpm: number): number {
  return (beatIndex * 60) / bpm;
}

/**
 * Ist der Klick nach diesem Schlag fertig?
 *
 * Nur im Einzähl-Betrieb; dauerhaft läuft er bis zum Abschalten. Das Ende ist bewusst hier und
 * nicht im Ton-Code: Es ist eine Regel, keine Ausgabe.
 */
export function countInDone(
  beatIndex: number,
  timeSig: string | null | undefined,
  modus: 'einzaehlen' | 'dauerhaft',
): boolean {
  return modus === 'einzaehlen' && beatIndex >= countInBeats(timeSig);
}
