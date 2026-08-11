/**
 * Wie eine Anmerkungs-EBENE benannt wird – an EINER Stelle (11.08.2026).
 *
 * **Warum es diese Datei gibt:** Dieselbe Angabe steht an zwei Stellen auf dem Bildschirm – in der
 * Auswahl „Notizen von …" und im blauen Streifen darüber, solange man ansieht. Beide beschrieben sie
 * getrennt und mit verschiedenen Worten: die Auswahl „Version „Original" · Akkorde & Text", der
 * Streifen dasselbe noch einmal anders, und das Arrangement kam in keinem von beiden vor. Von Alwin
 * gemeldet: „Ich weiß nicht genau, was was ist."
 *
 * Genau diese Doppelung ist die teuerste Fehlerklasse dieses Projekts. Deshalb formuliert es ab jetzt
 * **eine** Funktion, und beide Stellen rufen sie.
 *
 * **Die Wörter sind bewusst die des Lied-Menüs** – ARRANGEMENT, VERSION, ANZEIGE. Wer dort umschaltet,
 * liest hier dieselben Begriffe wieder; ein eigenes Vokabular an dieser Stelle wäre eine zweite
 * Sprache für dieselbe Sache.
 */

/** So viel von einer Ebene, wie für ihre Benennung zählt. */
export interface EbeneZumBenennen {
  versionKey: string;
  lyr: boolean;
  arrangementId: number | null;
}

/** Die Namensauflösung kommt von außen – sie hängt am geladenen Lied, nicht an der Grammatik. */
export interface NamenQuelle {
  /** Slug → Anzeigename („akustik" → „Akustik"). */
  versionName: (versionKey: string) => string;
  /**
   * Arrangement-ID → Anzeigename, oder `null`, wenn das Arrangement nicht genannt werden soll.
   *
   * `null` bei einem Lied mit nur EINEM Arrangement: Dann unterscheidet es nichts und macht die
   * Angabe nur länger (so von Alwin entschieden).
   */
  arrangementName: (arrangementId: number | null) => string | null;
}

export interface EbenenBeschreibung {
  /** Kopfzeile der Auswahl-Zeile: „Arrangement: Test" – `null`, wenn es nicht genannt wird. */
  arrangement: string | null;
  /** Zweite Zeile: „Version: Original · Anzeige: Akkorde & Text". */
  details: string;
  /** Alles in einer Zeile – für den Streifen oben, der nur eine hat. */
  einzeilig: string;
}

/** Wie die Darstellungsart heißt – dieselben zwei Wörter wie im Lied-Menü unter ANZEIGE. */
export function anzeigeName(lyr: boolean): string {
  return lyr ? 'Nur Text' : 'Akkorde & Text';
}

export function beschreibeEbene(ebene: EbeneZumBenennen, namen: NamenQuelle): EbenenBeschreibung {
  const arrName = namen.arrangementName(ebene.arrangementId);
  const arrangement = arrName === null ? null : `Arrangement: ${arrName}`;
  const details = `Version: ${namen.versionName(ebene.versionKey)} · Anzeige: ${anzeigeName(ebene.lyr)}`;
  return {
    arrangement,
    details,
    einzeilig: arrangement === null ? details : `${arrangement} · ${details}`,
  };
}
