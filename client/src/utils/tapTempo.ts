import { MAX_BPM, MIN_BPM } from './bpmPulse';

/**
 * Tempo durch Antippen bestimmen (#145 Folge-Wunsch).
 *
 * Man tippt im Takt mit, daraus wird das Tempo. Klingt trivial, hat aber drei Fallen, und alle drei
 * sind reine Rechnung – deshalb hier und nicht in der Komponente:
 *
 *  - **Ein Ausrutscher darf nicht alles verderben.** Gemittelt wird über die letzten Abstände; ein
 *    einzelner zu langer oder zu kurzer verzieht das Ergebnis dann nur wenig.
 *  - **Nach einer Pause fängt man neu an.** Wer aufhört und später weitertippt, meint einen neuen
 *    Versuch – nicht einen riesigen Abstand.
 *  - **Unsinn wird nicht gespeichert.** Der plausible Bereich ist derselbe wie beim Puls; es gibt
 *    ihn bewusst nur EINMAL (in `bpmPulse`), damit beide nicht auseinanderlaufen können.
 */

/** Längere Pause = neuer Versuch. Zwei Sekunden entsprechen 30 bpm – langsamer tippt niemand mit. */
export const NEUSTART_NACH_MS = 2000;

/** So viele Abstände fließen höchstens ein. Mehr macht das Ergebnis träge, weniger zappelig. */
export const MAX_ABSTAENDE = 8;

/** Erst ab so vielen Tipps gibt es ein Ergebnis – aus einem einzigen folgt kein Abstand. */
export const MIN_TIPPS = 3;

/**
 * Langsamstes Tempo, das sich ÜBERHAUPT antippen lässt – 30 bpm.
 *
 * Folgt zwingend aus `NEUSTART_NACH_MS`: Wer langsamer tippt, überschreitet mit jedem Abstand die
 * Pausengrenze, und jeder Tipp beginnt eine neue Serie. Der Wert ist also keine Wahl, sondern eine
 * **Folge** – deshalb wird er ausgerechnet und nicht hingeschrieben.
 *
 * Er liegt bewusst ÜBER dem `MIN_BPM` des Pulses (20): Ein Lied mit 24 bpm darf pulsen, antippen
 * lässt sich ein solches Schleichtempo nicht sinnvoll. Diese Lücke ist bekannt und in Ordnung –
 * schlimmer wäre eine stillschweigende Abweichung, die niemand erklären kann.
 */
export const MIN_TAP_BPM = Math.ceil(60_000 / NEUSTART_NACH_MS);

/**
 * Die Tipp-Zeitpunkte auf den aktuellen Versuch kürzen.
 *
 * Alles vor der letzten längeren Pause fällt weg. Getrennt von der Mittelung, weil man beides
 * einzeln prüfen können soll.
 */
export function aktuelleSerie(zeitstempel: number[]): number[] {
  if (zeitstempel.length === 0) return [];
  let start = 0;
  for (let i = 1; i < zeitstempel.length; i++) {
    if (zeitstempel[i] - zeitstempel[i - 1] > NEUSTART_NACH_MS) start = i;
  }
  return zeitstempel.slice(start);
}

/**
 * Tempo aus den Tipp-Zeitpunkten – oder `null`, wenn es dafür noch nicht reicht.
 *
 * Gemittelt wird über die Abstände der letzten Tipps. Das Ergebnis wird auf ganze Schläge gerundet:
 * ChurchTools führt das Tempo als ganze Zahl, und „118,3" wäre ohnehin vorgetäuschte Genauigkeit.
 */
export function tempoAusTipps(zeitstempel: number[]): number | null {
  const serie = aktuelleSerie(zeitstempel);
  if (serie.length < MIN_TIPPS) return null;

  const abstaende: number[] = [];
  for (let i = serie.length - 1; i > 0 && abstaende.length < MAX_ABSTAENDE; i--) {
    abstaende.push(serie[i] - serie[i - 1]);
  }
  const mittel = abstaende.reduce((a, b) => a + b, 0) / abstaende.length;
  if (mittel <= 0) return null;

  const bpm = Math.round(60_000 / mittel);
  // Außerhalb des plausiblen Bereichs lieber nichts liefern als etwas Falsches anbieten – der Wert
  // landet am Ende in ChurchTools und gilt dort für alle. Nach unten greift zusätzlich
  // MIN_TAP_BPM: Langsameres kommt hier ohnehin nie an (jeder Abstand wäre eine Pause).
  return bpm >= Math.max(MIN_BPM, MIN_TAP_BPM) && bpm <= MAX_BPM ? bpm : null;
}
