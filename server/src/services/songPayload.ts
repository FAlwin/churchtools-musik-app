import type { CtSong } from './ctTypes.js';
import type { LiedStammdaten } from '@shared/types/index';

/**
 * Schreib-Payload für die **Stammdaten eines Liedes** (#322, Schritt 11) – die dritte riskante reine
 * Funktion des Projekts, nach `agendaItemWritePayload` und `arrangementWritePayload`.
 *
 * **Die Gefahr, gemessen an der ChurchTools-Test-Instanz (13.08.2026):**
 * `PUT /api/songs/{id}` **ersetzt den ganzen Datensatz.** Alles, was nicht mitgeschickt wird, ist
 * danach leer. Ein Versuch mit nur den zwei Pflichtfeldern löschte in einem Zug Autor, CCLI-Nummer
 * und Copyright:
 *
 * ```
 * vorher : author "Test Autor", ccli "1234567", copyright "Test Copyright", shouldPractice true
 * PUT { name, categoryId }
 * nachher: author null, ccli null, copyright null, shouldPractice false
 * ```
 *
 * Das ginge das ganze Team an und wäre über die App nicht wiederherstellbar. Deshalb baut diese
 * Funktion den Payload **immer aus dem gelesenen Ist-Zustand** und legt nur die gewünschte Änderung
 * darüber – dieselbe Lehre wie beim Arrangement, dort steht sie seit dem 08.08.2026.
 *
 * **Der erste Messversuch hat die Frage falsch gestellt** und ist als Warnung hier festgehalten: Er
 * schickte nur `{name}` und bekam **400**, weil `categoryId` beim `PUT` Pflicht ist. Dass danach alle
 * Felder noch standen, sah nach „ungefährlich" aus – der Aufruf hatte aber gar nicht geschrieben. Ein
 * Messaufbau, der den geprüften Vorgang nicht auslöst, belegt nichts.
 *
 * **`note` ist NICHT dabei:** ChurchTools markiert es am Lied als `@deprecated` und speichert es weder
 * beim Anlegen noch beim Ändern (beides gemessen). Ein Feld, das nichts behält, gehört in keinen
 * Payload.
 */

/** Was sich an den Stammdaten ändern lässt – dieselben Felder, die auch das Anlegen kennt. */
export type SongOverrides = Partial<LiedStammdaten>;

/**
 * Die Felder, die beim Schreiben erhalten bleiben MÜSSEN.
 *
 * Sie stehen als Liste hier und nicht verstreut im Code: Wer ChurchTools ein Feld hinzufügt, ergänzt
 * genau eine Stelle – sonst wird es beim nächsten Speichern stillschweigend gelöscht. `shouldPractice`
 * ist das Beispiel dafür: Die App zeigt es nirgends an, ein Teil-`PUT` würde es aber auf `false`
 * setzen und damit eine Angabe verlieren, die jemand in ChurchTools gemacht hat.
 */
const ZU_ERHALTEN = ['name', 'author', 'ccli', 'copyright', 'shouldPractice'] as const;

/**
 * Baut den Schreib-Payload aus dem gelesenen Lied plus der gewünschten Änderung.
 *
 * `null`/`undefined` werden weggelassen statt mitgeschickt – ein Feld, das schon leer ist, muss nicht
 * geleert werden, und ChurchTools lehnt manche Felder mit `null` ab.
 *
 * **Ein ausdrücklich geleertes Feld muss aber leer werden**, sonst ließe sich eine falsche Angabe nie
 * wieder entfernen. Dafür wird die gemessene Eigenschaft **genutzt**, statt eine zweite anzunehmen:
 * `''` heißt „leeren" und lässt das Feld aus dem Payload fallen – und was nicht mitkommt, ist danach
 * `null` (genau das war der Messbefund). Ob ChurchTools ein gesendetes `''` auch leert, ist damit gar
 * nicht erst eine offene Frage. `undefined` heißt „nicht geändert" und behält den Ist-Wert.
 */
export function songWritePayload(
  song: CtSong,
  overrides: SongOverrides = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const feld of ZU_ERHALTEN) {
    const wert = song[feld];
    if (wert !== undefined && wert !== null) body[feld] = wert;
  }

  /**
   * `categoryId` ist Pflicht (gemessen: ein `PUT` ohne sie ergibt 400) – und beim Lesen heißt das Feld
   * `category.id`. Fehlt beides, wird nicht geschrieben: Ein geratener Wert würde das Lied in eine
   * fremde Kategorie verschieben.
   */
  const bestehendeKategorie = song.category?.id;
  if (typeof bestehendeKategorie === 'number') body.categoryId = bestehendeKategorie;

  for (const [feld, wert] of Object.entries(overrides)) {
    if (wert === undefined) continue;
    // Leerer Text = ausdrücklich leeren → Feld weglassen; ChurchTools setzt es dann auf `null`.
    if (typeof wert === 'string' && wert.trim() === '') delete body[feld];
    else body[feld] = typeof wert === 'string' ? wert.trim() : wert;
  }

  // Pflichtfelder gegenprüfen, statt ChurchTools einen Validierungsfehler antworten zu lassen: Hier
  // ist noch bekannt, WELCHE Angabe fehlt.
  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    throw new Error('Lied ohne Namen – Schreiben abgebrochen, um nichts zu überschreiben.');
  }
  if (typeof body.categoryId !== 'number') {
    throw new Error('Lied ohne Kategorie – Schreiben abgebrochen, um nichts zu überschreiben.');
  }

  return body;
}
