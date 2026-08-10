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
export function taktartTeile(
  timeSig: string | null | undefined,
): { zaehler: number; nenner: number } | null {
  if (!timeSig) return null;
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(timeSig);
  if (!m) return null;
  const zaehler = Number(m[1]);
  const nenner = Number(m[2]);
  if (zaehler < 1 || zaehler > 16) return null;
  return { zaehler, nenner };
}

export function beatsPerBar(timeSig: string | null | undefined): number {
  return taktartTeile(timeSig)?.zaehler ?? DEFAULT_BEATS_PER_BAR;
}

/**
 * Wie viele Grundschläge werden zu EINEM gezählten Schlag zusammengefasst? (#145)
 *
 * Der Grund: Ein 6/8-Stück zählt man in Zweiern (zwei punktierte Viertel), nicht als sechs Achtel;
 * ein schnelles 4/4 zählt man in Halben. Beides ist dieselbe Frage, und sie hat genau eine Zahl als
 * Antwort. Aus ihr folgt alles Weitere: das Klick-Tempo (Grundtempo geteilt durch sie) und die
 * Länge des Takts in gezählten Schlägen – und damit, wo die Eins sitzt.
 *
 * Mehr als 3 gibt es bewusst nicht: Alles darüber ist keine Zählweise mehr, sondern ein anderes
 * Stück.
 */
export const ZAEHLWEISEN = [1, 2, 3] as const;

/**
 * Vorschlag aus der Taktart.
 *
 * **Nur zusammengesetzte Achteltaktarten** (6/8, 9/8, 12/8) bekommen Dreiergruppen – dort ist es
 * die Regel und nicht die Ausnahme. Alles andere bleibt bei Einzelschlägen.
 *
 * Bewusst NICHT nach dem Tempo entschieden („schnelles 4/4 in Halben"): Das wäre eine Automatik,
 * die beim Verstellen des Tempos plötzlich die Zählweise umwirft. Für diesen Fall gibt es den
 * Umschalter – eine Vermutung, die man nicht kommen sieht, ist schlimmer als eine Einstellung.
 */
export function autoZaehlweise(timeSig: string | null | undefined): number {
  const t = taktartTeile(timeSig);
  if (!t) return 1;
  return t.nenner === 8 && t.zaehler > 3 && t.zaehler % 3 === 0 ? 3 : 1;
}

/**
 * Die Zählweise, die WIRKLICH gilt: die gewählte, sonst der Vorschlag aus der Taktart.
 *
 * Steht hier und nicht an den zwei Stellen, die sie brauchen (Liederheft und Tempo-Menü). Als
 * `gewaehlt ?? autoZaehlweise(timeSig)` war sie schon einmal doppelt ausgeschrieben – und genau bei
 * solchen Paaren wird später eines nachgezogen und das andere nicht. Dann zeigte das Menü eine
 * andere Zählweise an, als geklickt wird.
 */
export function wirksameZaehlweise(
  gewaehlt: number | null,
  timeSig: string | null | undefined,
): number {
  return gewaehlt ?? autoZaehlweise(timeSig);
}

/**
 * Welche Zählweisen ergeben in dieser Taktart überhaupt einen Takt?
 *
 * Nur Teiler der Schläge je Takt: 4/4 lässt sich in Einzelnen und Zweiern zählen, aber nicht in
 * Dreiern – daraus folgte ein Takt von 1⅓ gezählten Schlägen, und die Eins säße irgendwo. Was
 * keinen Takt ergibt, wird gar nicht erst angeboten.
 */
export function moeglicheZaehlweisen(timeSig: string | null | undefined): number[] {
  const proTakt = beatsPerBar(timeSig);
  return ZAEHLWEISEN.filter((z) => proTakt % z === 0);
}

/** Länge des Takts in GEZÄHLTEN Schlägen. Bei einer unmöglichen Zählweise bleibt es beim Grundtakt. */
export function gezaehlteSchlaegeProTakt(
  timeSig: string | null | undefined,
  zaehlweise: number,
): number {
  const proTakt = beatsPerBar(timeSig);
  if (zaehlweise < 1 || proTakt % zaehlweise !== 0) return proTakt;
  return proTakt / zaehlweise;
}

/**
 * Das Tempo, in dem geklickt und gepulst wird.
 *
 * Die gespeicherte Zahl meint IMMER die Grundschläge (die notierte Zählzeit) – sie bedeutet damit
 * für jeden dasselbe, unabhängig davon, wie er zählt. Die Zählweise ist eine persönliche Sache und
 * steht nicht in ChurchTools; hinge die gespeicherte Zahl an ihr, hätte dasselbe Lied für zwei
 * Leute unterschiedliche Tempi.
 */
export function gezaehltesTempo(bpm: number | null, zaehlweise: number): number | null {
  if (bpm === null || zaehlweise < 1) return bpm;
  return bpm / zaehlweise;
}

/**
 * Wie viele Schläge dauert das Einzählen?
 *
 * Nimmt die GEZÄHLTEN Schläge je Takt, nicht die Taktart-Zeichenkette: Wer in Dreiergruppen zählt,
 * zählt zwei Takte à zwei ein und nicht à sechs. Die Umrechnung passiert einmal weiter oben, damit
 * sie nicht in jeder Funktion erneut stattfindet.
 */
export function countInBeats(schlaegeProTakt: number): number {
  return COUNT_IN_BARS * schlaegeProTakt;
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
 * Der erste Schlag, der NACH `verstrichenMs` im laufenden Raster liegt.
 *
 * Gebraucht, wenn der Klick zu einem bereits laufenden Puls dazukommt (#145): Er darf dann nicht
 * bei null anfangen, sondern muss ins bestehende Raster einsteigen – sonst schlagen Auge und Ohr
 * verschieden, und genau das war gemeldet.
 */
export function erstesSchlagAb(verstrichenMs: number, bpm: number): number {
  if (verstrichenMs <= 0) return 0;
  return Math.ceil(verstrichenMs / ((60 * 1000) / bpm));
}

/**
 * Ab welchem Schlag darf das EINZÄHLEN beginnen, wenn das Raster schon läuft?
 *
 * Nicht irgendwo mitten im Takt: Einzählen heißt „eins, zwei, drei, vier", und das ergibt nur ab
 * einer Eins einen Sinn. Deshalb wird auf den nächsten Taktanfang aufgerundet. Läuft noch nichts,
 * ist `abIndex` null und das Ergebnis ebenfalls – dann fängt es sofort an.
 */
export function einzaehlStart(abIndex: number, beatsProTakt: number): number {
  if (beatsProTakt <= 0) return abIndex;
  return Math.ceil(abIndex / beatsProTakt) * beatsProTakt;
}

/**
 * Ist der Klick nach diesem Schlag fertig?
 *
 * Nur im Einzähl-Betrieb; dauerhaft läuft er bis zum Abschalten. Das Ende ist bewusst hier und
 * nicht im Ton-Code: Es ist eine Regel, keine Ausgabe.
 *
 * `startIndex` ist der Schlag, bei dem DIESES Einzählen begonnen hat. Seit der Klick in ein schon
 * laufendes Raster einsteigen kann (gemeinsamer Takt mit dem Puls), ist der nicht mehr zwangsläufig
 * null – gezählt werden muss trotzdem ab dem eigenen Anfang, sonst wäre das Einzählen je nachdem,
 * wann man es drückt, zu kurz oder käme gar nicht erst zustande.
 */
export function countInDone(
  beatIndex: number,
  schlaegeProTakt: number,
  modus: 'einzaehlen' | 'dauerhaft',
  startIndex = 0,
): boolean {
  return modus === 'einzaehlen' && beatIndex - startIndex >= countInBeats(schlaegeProTakt);
}

/**
 * Alles, was Puls und Klick brauchen – aus dem gespeicherten Tempo, der Taktart und der gewählten
 * Zählweise. **Die einzige Stelle, an der diese drei Werte zusammen entstehen.**
 *
 * Vorher standen die drei Ableitungen einzeln im Liederheft. Jede für sich war richtig, aber keine
 * war geprüft – die Gegenprobe „Klick ignoriert die Zählweise" liess sich zurücknehmen, ohne dass
 * ein Test fiel. Als eine Funktion sind sie prüfbar, und es gibt nur einen Ort, an dem sie
 * auseinanderlaufen könnten: hier.
 */
export interface TaktRaster {
  /** Die wirklich geltende Zählweise (gewählt oder aus der Taktart). */
  zaehlweise: number;
  /** Tempo, in dem geklickt und gepulst wird. */
  klickTempo: number | null;
  /** Länge des Takts in gezählten Schlägen – bestimmt, wo die Eins sitzt. */
  schlaegeProTakt: number;
}

export function taktRaster(
  bpm: number | null,
  timeSig: string | null | undefined,
  gewaehlteZaehlweise: number | null,
): TaktRaster {
  const zaehlweise = wirksameZaehlweise(gewaehlteZaehlweise, timeSig);
  return {
    zaehlweise,
    klickTempo: gezaehltesTempo(bpm, zaehlweise),
    schlaegeProTakt: gezaehlteSchlaegeProTakt(timeSig, zaehlweise),
  };
}
