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

/** Was sich am Arrangement ändern lässt. Bewusst schmal – jedes Feld mehr ist ein Risiko mehr. */
export interface ArrangementOverrides {
  /** Neues Tempo in Schlägen je Minute. */
  tempo?: number;
}

/**
 * Die Felder, die beim Schreiben erhalten bleiben MÜSSEN.
 *
 * Sie stehen hier als Liste und nicht verstreut im Code: Wer ChurchTools ein Feld hinzufügt, muss
 * genau eine Stelle ergänzen – sonst wird es beim nächsten Tempo-Wechsel stillschweigend gelöscht.
 */
const ZU_ERHALTEN = [
  'name',
  'key',
  'keyOfArrangement',
  'beat',
  'duration',
  'description',
  'note',
  'isDefault',
] as const;

/**
 * Baut den Schreib-Payload aus dem gelesenen Arrangement plus der gewünschten Änderung.
 *
 * `null`/`undefined` werden weggelassen statt mitgeschickt – ChurchTools lehnt manche Felder mit
 * `null` ab, und ein Feld, das schon leer ist, muss nicht geleert werden.
 */
export function arrangementWritePayload(
  arr: CtArrangement & Record<string, unknown>,
  overrides: ArrangementOverrides = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const feld of ZU_ERHALTEN) {
    const wert = arr[feld];
    if (wert !== undefined && wert !== null) body[feld] = wert;
  }
  // `name` ist Pflicht (1–50 Zeichen) – fehlt er im gelesenen Datensatz, wäre der Payload ungültig.
  // Lieber ein sprechender Fehler hier als ein Validierungsfehler aus ChurchTools.
  if (typeof body.name !== 'string' || body.name.length === 0) {
    throw new Error('Arrangement ohne Namen – Schreiben abgebrochen, um nichts zu überschreiben.');
  }

  // Das bestehende Tempo mitschicken, damit es nicht verloren geht; `tempo` schlägt es.
  const bestehend = arr.tempo ?? arr.bpm;
  if (typeof bestehend === 'number') body.tempo = bestehend;
  else if (typeof bestehend === 'string' && bestehend.trim() !== '') body.tempo = Number(bestehend);

  if (overrides.tempo !== undefined) body.tempo = overrides.tempo;

  return body;
}
