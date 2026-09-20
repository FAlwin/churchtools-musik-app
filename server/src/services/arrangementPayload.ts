import type { CtArrangement } from './ctTypes.js';

/**
 * Schreib-Payload für ein Arrangement in ChurchTools – die zweite riskante reine Funktion des
 * Projekts, nach `agendaItemWritePayload`.
 *
 * **Die Gefahr, empirisch festgestellt (08.08.2026, gegen die ChurchTools-Test-Instanz):**
 * `PUT /api/songs/{id}/arrangements/{arrId}` **ersetzt den ganzen Datensatz**. Alles, was nicht
 * mitgeschickt wird, ist danach `null`. Ein Versuch mit nur `{ name, bpm }` löschte in einem Zug
 * Tonart, zweite Tonart und Dauer:
 *
 * ```
 * vorher : key "C", keyOfArrangement "C", duration 300, tempo 120
 * PUT { name, bpm: 99 }
 * nachher: key null, keyOfArrangement null, duration null, tempo null
 * ```
 *
 * Das gälte für das ganze Team und wäre über die App nicht wiederherstellbar. Deshalb baut diese
 * Funktion den Payload **immer aus dem gelesenen Ist-Zustand** und legt nur die gewünschte Änderung
 * darüber.
 *
 * **Und: `bpm` ist NICHT das beschreibbare Feld.** Es kommt als Zeichenkette zurück (`"120"`) und
 * ist abgeleitet; geschrieben wird `tempo` als Zahl. Im selben Versuch blieb `bpm` trotz
 * `bpm: 99` auf `null`, während `tempo: 99` es korrekt auf `"99"` setzte.
 */

/**
 * Was sich am Arrangement ändern lässt (#396 – vorher nur das Tempo).
 *
 * **`undefined` heißt „nicht anfassen", `null` heißt „leeren".** Der Unterschied ist kein Feinsinn:
 * Ein Formular, das nur den Namen ändert, schickt für die Tonart `undefined` – sie muss erhalten
 * bleiben. Wer die Tonart löschen will, schickt `null`, und dann darf sie NICHT aus dem Ist-Zustand
 * zurückkommen. Ohne diese Unterscheidung ließe sich kein Feld je wieder leeren.
 */
export interface ArrangementOverrides {
  name?: string;
  /** Tonart. */
  key?: string | null;
  /** Tempo in Schlägen je Minute. */
  tempo?: number | null;
  /** Taktart, als Text („4/4"). */
  beat?: string | null;
  /** Länge in **Sekunden** – so führt ChurchTools sie (gemessen: 245 → 4:05). */
  duration?: number | null;
  description?: string | null;
  /** Die Quelle (Liederbuch) als ID aus `getSongSources`. */
  sourceId?: number | null;
  /** Die Liednummer in dieser Quelle – ohne Quelle unmöglich, siehe `quelleAufloesen`. */
  sourceReference?: string | null;
}

/**
 * Die Felder, die beim Schreiben erhalten bleiben MÜSSEN.
 *
 * Sie stehen hier als Liste und nicht verstreut im Code: Wer ChurchTools ein Feld hinzufügt, muss
 * genau eine Stelle ergänzen – sonst wird es beim nächsten Schreibvorgang stillschweigend gelöscht.
 *
 * **`note` steht hier NICHT mehr** (#396, gemessen 20.09.2026): ChurchTools nennt es selbst
 * `@deprecated` und meint damit `description` – es ist **dasselbe Feld**. Wer beides schickt,
 * bekommt nur `description` zurück. Zwei Namen für einen Wert im selben Payload sind die
 * Regel-Dopplung in Reinform: Sobald jemand die Beschreibung ändert, hängen zwei Felder daran, und
 * welches gewinnt, entscheidet ChurchTools. Der gelesene `note`-Wert geht trotzdem nicht verloren –
 * er wird unten als Rückfall für `description` benutzt.
 */
const ZU_ERHALTEN = ['name', 'key', 'keyOfArrangement', 'beat', 'duration', 'isDefault'] as const;

/**
 * Welche Quelle und welche Liednummer nach der Änderung gelten – **die Regel steht nur hier** (#396).
 *
 * **ChurchTools speichert eine Liednummer NUR zusammen mit einer Quelle** (gemessen: ein `PUT` mit
 * `sourceReference` ohne `sourceId` antwortet 200 und legt `null` ab – ein stiller Verlust). Der
 * ChurchTools-Dialog lehnt „Nummer ohne Quelle" deshalb schon im Formular ab („song.source.missing").
 *
 * Daraus folgen zwei Dinge, die zusammengehören und deshalb NICHT an zwei Stellen stehen dürfen:
 *
 *  1. Eine Liednummer ohne Quelle wird **abgelehnt** – mit einem Satz, der sagt, was fehlt. Stillt
 *     man das nur in der Oberfläche, verliert jeder, der den Endpunkt direkt aufruft, seine Eingabe
 *     wortlos.
 *  2. Wird die **Quelle entfernt**, geht die Nummer mit. Eine Liednummer ohne Buch ist keine
 *     Auskunft, sondern eine Zahl, die niemand mehr einordnen kann.
 */
export function quelleAufloesen(
  arr: CtArrangement,
  over: ArrangementOverrides,
): { sourceId: number | null; sourceReference: string | null } {
  const istQuelle = arr.source?.id ?? arr.sourceId ?? null;
  const istNummer = arr.sourceReference ?? null;

  const quelle = over.sourceId === undefined ? istQuelle : over.sourceId;
  const nummerRoh = over.sourceReference === undefined ? istNummer : over.sourceReference;
  const nummer = nummerRoh === null || nummerRoh.trim() === '' ? null : nummerRoh.trim();

  // Quelle weg → Nummer mit weg. Das ist kein Fehler, sondern die Folge einer bewussten Wahl.
  if (quelle === null) return { sourceId: null, sourceReference: null };

  return { sourceId: quelle, sourceReference: nummer };
}

/**
 * Prüft, ob eine Liednummer **ohne** Quelle verlangt wird – dieselbe Rechnung wie oben, nur als
 * Frage statt als Ergebnis. Der Aufrufer macht daraus die Meldung für den Nutzer.
 */
export function nummerOhneQuelle(arr: CtArrangement, over: ArrangementOverrides): boolean {
  const gewollt = over.sourceReference;
  const nummerGewollt =
    gewollt === undefined
      ? (arr.sourceReference ?? null) !== null
      : gewollt !== null && gewollt.trim() !== '';
  if (!nummerGewollt) return false;
  return quelleAufloesen(arr, over).sourceId === null;
}

/**
 * Baut den Schreib-Payload aus dem gelesenen Arrangement plus der gewünschten Änderung.
 *
 * **Drei Zustände je Feld, nicht zwei:** nicht genannt (`undefined`) → der alte Wert kommt mit;
 * genannt mit Wert → der neue Wert; genannt als `null` → das Feld bleibt weg, und weil `PUT`
 * ersetzt, ist es danach leer. Das Leeren passiert also durch **Weglassen** – genau das Verhalten,
 * das im Kopf dieser Datei als Gefahr beschrieben ist, hier einmal bewusst genutzt.
 */
export function arrangementWritePayload(
  arr: CtArrangement,
  overrides: ArrangementOverrides = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const feld of ZU_ERHALTEN) {
    const wert = arr[feld];
    if (wert !== undefined && wert !== null) body[feld] = wert;
  }

  /**
   * Die Beschreibung: `description` ist der gültige Name, `note` der alte für dasselbe Feld. Der
   * Rückfall steht hier, damit ein Bestand, den ChurchTools nur unter `note` herausgibt, beim
   * nächsten Speichern nicht leer wird.
   */
  const beschreibung = arr.description ?? arr.note ?? null;
  if (typeof beschreibung === 'string' && beschreibung !== '') body.description = beschreibung;

  // `name` ist Pflicht (1–50 Zeichen) – fehlt er im gelesenen Datensatz, wäre der Payload ungültig.
  // Lieber ein sprechender Fehler hier als ein Validierungsfehler aus ChurchTools.
  if (typeof body.name !== 'string' || body.name.length === 0) {
    throw new Error('Arrangement ohne Namen – Schreiben abgebrochen, um nichts zu überschreiben.');
  }

  // Das bestehende Tempo mitschicken, damit es nicht verloren geht; `tempo` schlägt es.
  const bestehend = arr.tempo ?? arr.bpm;
  if (typeof bestehend === 'number') body.tempo = bestehend;
  else if (typeof bestehend === 'string' && bestehend.trim() !== '') body.tempo = Number(bestehend);

  /**
   * Die gewünschten Änderungen darüber – **eine Schleife, kein Feld einzeln von Hand.** Als
   * abgeschriebene Zeilen („if (over.key !== undefined) …") wäre jedes neue Feld eine Stelle, die
   * jemand vergisst; der Compiler sieht so etwas nicht.
   *
   * Quelle und Liednummer fehlen hier mit Absicht: Sie hängen voneinander ab und werden unten
   * gemeinsam gesetzt.
   */
  const einfach = ['name', 'key', 'tempo', 'beat', 'duration', 'description'] as const;
  for (const feld of einfach) {
    const wert = overrides[feld];
    if (wert === undefined) continue;
    if (wert === null || (typeof wert === 'string' && wert.trim() === '')) {
      delete body[feld];
      // `keyOfArrangement` ist ChurchTools' alter Name für `key` – wer die Tonart leert, muss beide
      // loswerden, sonst schreibt der alte Name sie zurück.
      if (feld === 'key') delete body.keyOfArrangement;
      continue;
    }
    body[feld] = typeof wert === 'string' ? wert.trim() : wert;
    if (feld === 'key') body.keyOfArrangement = body.key;
  }

  const { sourceId, sourceReference } = quelleAufloesen(arr, overrides);
  if (sourceId !== null) {
    body.sourceId = sourceId;
    if (sourceReference !== null) body.sourceReference = sourceReference;
  }

  return body;
}
