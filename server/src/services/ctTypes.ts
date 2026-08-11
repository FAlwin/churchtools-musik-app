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

export interface CtSong {
  id: number;
  name: string;
  author: string | null;
  ccli: string | null;
  arrangements: CtArrangement[];
}

export interface CtService {
  id: number;
  name: string;
  sortKey?: number;
}

export interface CtSongListEntry {
  id: number;
  name: string;
  author: string | null;
  arrangements: {
    id: number;
    name: string;
    key: string | null;
    keyOfArrangement: string | null;
    isDefault?: boolean;
    bpm?: number | null;
  }[];
}
