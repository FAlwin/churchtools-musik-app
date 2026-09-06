/**
 * Die Rohdaten-Typen von ChurchTools – **nur Typen, kein Verhalten** (#280).
 *
 * Bewusst ohne jeden Import: Dieses Modul ist die Wurzel des Abhängigkeits-Baums. Solange hier nichts
 * hineinzeigt, kann auch kein Import-Zirkel entstehen – genau der Fallstrick, der `agendaPayload.ts`
 * (#212) schon einmal zu einem eigenen Modul gemacht hat.
 *
 * Es sind die Formen, die ChurchTools LIEFERT. Was die App daraus macht, steht in `@shared/types`.
 */

export interface ChurchToolsUser {
  id: number;
  firstName: string;
  lastName: string;
}

// ── Rohdaten-Typen (Ausschnitt der ChurchTools-Antworten) ──
export interface CtEvent {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  /** ID des zugehörigen Kalender-Termins (für den Untertitel) */
  appointmentId?: number;
  calendar?: { title?: string; domainIdentifier?: string };
}

/**
 * Abwesenheit aus `GET /api/persons/{id}/absences` (#177; Felder am 16.07.2026 verifiziert).
 * `startTime`/`endTime` null = ganztägig. `comment` trägt bei unseren Einträgen den Marker.
 */
export interface CtAbsence {
  id: number;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  comment?: string | null;
  absenceReason?: { id?: number | string; name?: string | null } | null;
}

export interface CtAgendaSong {
  songId: number;
  arrangementId: number;
  title: string;
  arrangement: string;
  key: string | null;
  bpm: number | null;
}

export interface CtAgendaItem {
  id: number;
  title: string;
  type?: string;
  note?: string;
  /** Dauer des Punkts in Sekunden (CT-Rohwert). */
  duration?: number;
  /** Von ChurchTools berechnete absolute Startzeit (ISO-8601, UTC) – null wenn keine. */
  start?: string | null;
  /**
   * Startzeit je Event-ID. MASSGEBLICH für „Uhrzeit ausgeblendet": ist `startTimes[eventId]`
   * `null`, hat der Nutzer die Uhrzeit dieses Punkts in ChurchTools ausgeblendet (durchgestrichenes
   * Auge) – das Feld `start` bleibt davon unberührt und ist daher NICHT verlässlich.
   */
  startTimes?: Record<string, string | null>;
  isBeforeEvent?: boolean;
  /** Beim Lesen ein Objekt; beim Schreiben wird nur `text` als String gesendet. */
  responsible?: { text?: string; persons?: { service?: string; person?: { title?: string } }[] };
  position?: number;
  song?: CtAgendaSong;
}

export interface CtArrangementFile {
  name: string;
  fileUrl: string;
  /**
   * Größe in Bytes – **optional und notfalls als Zeichenkette** (#321).
   *
   * ChurchTools liefert Zahlen je nach Endpunkt als Zahl ODER als Text; bei `bpm` ist genau das
   * schon aufgefallen (siehe `CtArrangement`). Wer hier `number` annimmt, rechnet irgendwann mit
   * `"12345"`. Auswertung deshalb nur über `arrangementFileEntries`.
   */
  size?: number | string | null;
}

export interface CtArrangement {
  id: number;
  name: string;
  key: string | null;
  keyOfArrangement: string | null;
  /**
   * Tempo als ABGELEITETER Wert – ChurchTools liefert es je nach Endpunkt als Zahl ODER als
   * Zeichenkette (`"120"`), und es ist **nicht beschreibbar**. Geschrieben wird `tempo`.
   */
  bpm: number | string | null;
  beat: string | null;
  isDefault?: boolean;
  files: CtArrangementFile[];

  // ── Felder, die beim SCHREIBEN erhalten bleiben müssen ──────────────────────────────
  // `PUT` auf ein Arrangement ersetzt den ganzen Datensatz: Alles, was nicht mitgeschickt wird,
  // ist danach `null`. An der Test-Instanz gemessen (08.08.2026) löschte ein `PUT { name, bpm }`
  // Tonart, zweite Tonart und Dauer in einem Zug. Sie stehen deshalb hier – nicht weil die App sie
  // anzeigt, sondern weil sie sie zurückschreiben MUSS. Siehe `arrangementPayload.ts`.
  /** Das beschreibbare Tempo (Zahl). */
  tempo?: number | null;
  duration?: number | null;
  description?: string | null;
  note?: string | null;
}

/**
 * Ein Lied, wie ChurchTools es liefert.
 *
 * **Die Felder unterhalb von `arrangements` stehen hier, weil das Ändern der Stammdaten sie braucht**
 * (#322, Schritt 11): `PUT /api/songs/{id}` ersetzt den ganzen Datensatz, deshalb muss der
 * Ist-Zustand vollständig gelesen werden, bevor etwas darüber gelegt wird. Gemessen an der
 * ChurchTools-Test-Instanz (13.08.2026) liefert `GET /api/songs/{id}`: `id`, `name`, `category`,
 * `author`, `copyright`, `ccli`, `shouldPractice`, `arrangements`, `meta`, `note`.
 *
 * `category` ist beim **Lesen** ein Objekt, beim **Schreiben** heißt das Feld `categoryId` – die
 * Umrechnung macht `songWritePayload`, damit sie nicht an mehreren Stellen entsteht.
 *
 * `note` fehlt hier mit Absicht: ChurchTools markiert es am Lied als `@deprecated` und **speichert es
 * weder beim Anlegen noch beim Ändern** (beides gemessen). Ein Feld, das nichts behält, gehört in
 * keinen Payload und in kein Formular.
 */
export interface CtSong {
  id: number;
  name: string;
  author: string | null;
  ccli: string | null;
  copyright?: string | null;
  category?: CtSongCategory | null;
  /** ChurchTools-Kennzeichen „sollte geübt werden" – wird beim Schreiben mitgeführt, nicht angezeigt. */
  shouldPractice?: boolean;
  arrangements: CtArrangement[];
}

export interface CtService {
  id: number;
  name: string;
  sortKey?: number;
}

/**
 * Die Kategorie, wie ChurchTools sie an einem Lied mitliefert (#322).
 *
 * Gemessen am 11.08.2026 (`probe-songmgmt.ts`): Sie steckt **vollständig** in jedem Lied der Liste –
 * `{id, name, nameTranslated, sortKey, campusId}`. Wir lesen nur die zwei Felder, die wir brauchen;
 * ein eigener Endpunkt für Kategorien existiert nicht (fünf Pfade geprüft, alle 404).
 */
export interface CtSongCategory {
  id: number;
  name: string;
}

export interface CtSongListEntry {
  id: number;
  name: string;
  author: string | null;
  /**
   * **Zeichenkette, nicht Zahl** – gemessen `"5841527"`.
   *
   * Wichtig für die Doppel-Erkennung beim Anlegen (#322): Verglichen wird getrimmter Text. Als Zahl
   * gelesen verlöre eine Nummer mit führender Null ihre Identität, und `Number('')` wäre `0` – also
   * genau ein falscher Treffer bei jedem Lied ohne Nummer.
   */
  ccli?: string | null;
  /** Fehlt bei einem Lied ohne Kategorie – die Zuordnung ist in ChurchTools nicht erzwungen. */
  category?: CtSongCategory | null;
  arrangements: {
    id: number;
    name: string;
    key: string | null;
    keyOfArrangement: string | null;
    isDefault?: boolean;
    bpm?: number | null;
    /**
     * Die Dateien des Arrangements – **kommen in der Liste mit** (gemessen 13.08.2026).
     *
     * Gebraucht vom Suchindex über die Liedtexte (#322): Er findet so das Original-ChordPro jedes
     * Liedes, ohne je Lied zusätzlich das Arrangement abzurufen. Das wären ~50 Anfragen mehr – genau
     * die Sorte Last, die in #300 die Drosselung ausgelöst hat.
     */
    files?: { name: string; fileUrl: string }[];
  }[];
}
