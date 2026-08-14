/**
 * Ein teurer, organisationsweit gleicher Lauf – **höchstens einer gleichzeitig, mit Sperrfrist nach
 * einer Drosselung** (#300).
 *
 * Zwei Läufe dieser Art gibt es: die Song-Statistik (~250 ChurchTools-Anfragen) und der Suchindex über
 * die Liedtexte (~50 Datei-Downloads). Beide brauchen dieselben drei Vorkehrungen:
 *
 *  1. **Bündeln.** Öffnen fünf iPads gleichzeitig die Liederliste, darf **ein** Lauf starten, nicht
 *     fünf. Genau dieser Fall hat in #300 das ChurchTools-Limit gerissen – danach scheiterten
 *     Anmeldung, Rechte und Speichern gleichzeitig.
 *  2. **Nach einer Drosselung eine Weile gar nicht erst versuchen.** Sonst rennt jeder Aufruf erneut in
 *     die Wand und verlängert die Drosselung, die er abwarten sollte.
 *  3. **Aufräumen ist Pflicht** – der laufende Vorgang muss auch nach einem Fehler freigegeben werden,
 *     sonst wartet die App für immer auf einen Lauf, den niemand mehr macht.
 *
 * **Warum als Baustein und nicht zweimal geschrieben:** Die Statistik hatte diese Mechanik zuerst,
 * handgeschrieben. Der Suchindex hätte sie kopiert – und die nächste Korrektur wäre in genau einer der
 * beiden Fassungen gelandet. Das ist die Fehlerklasse, die dieses Projekt am häufigsten getroffen hat.
 *
 * **Was hier NICHT liegt:** der Zwischenspeicher selbst. Was gecacht wird und wann es veraltet, ist bei
 * beiden verschieden (die Statistik merkt sich zusätzlich, aus welchen Terminen ein Stand gebaut wurde,
 * um gezielt zu verwerfen). Dieser Baustein regelt nur „wer darf jetzt laufen".
 *
 * ⚠️ Prozesslokal – siehe „Ein Prozess, ein Zustand" in `docs/entwicklung/entscheidungen.md`.
 */

export interface GebuendelterLauf<T> {
  /**
   * Führt `lauf` aus – oder hängt sich an einen bereits laufenden an.
   *
   * Der laufende Vorgang wird **immer** freigegeben, auch wenn `lauf` wirft.
   */
  fuehreAus(lauf: () => Promise<T>): Promise<T>;
  /** Gilt gerade eine Sperrfrist nach einer Drosselung? */
  istGesperrt(): boolean;
  /** Wie lange die Sperre noch gilt – für die `Retry-After`-Angabe an den Client. */
  restMs(): number;
  /**
   * Nach einer Drosselung: Sperrfrist beginnen.
   *
   * `ms` überschreibt die Standarddauer – ChurchTools nennt in `Retry-After` manchmal selbst, wie lange
   * es gebremst sein will (#300). Diesen Wert zu verwerfen wäre ein Rückschritt: Er ist genauer als
   * jede Pauschale.
   */
  sperren(ms?: number): void;
  /** Nach einem geglückten Lauf: Sperre aufheben. */
  entsperren(): void;
  /** Nur für Tests. */
  reset(): void;
}

export function createGebuendelterLauf<T>(cooldownMs: number): GebuendelterLauf<T> {
  let inflight: Promise<T> | null = null;
  let gesperrtBis = 0;

  return {
    fuehreAus(lauf) {
      if (inflight) return inflight;
      inflight = lauf().finally(() => {
        // `finally` und nicht `then`: Ein gescheiterter Lauf muss die Bahn genauso freigeben, sonst
        // hängt jeder weitere Aufruf an einem Versprechen, das niemand mehr erfüllt.
        inflight = null;
      });
      return inflight;
    },
    istGesperrt: () => Date.now() < gesperrtBis,
    restMs: () => Math.max(0, gesperrtBis - Date.now()),
    sperren(ms) {
      gesperrtBis = Date.now() + (ms ?? cooldownMs);
    },
    entsperren() {
      gesperrtBis = 0;
    },
    reset() {
      inflight = null;
      gesperrtBis = 0;
    },
  };
}
