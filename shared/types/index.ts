/**
 * Geteilte Typen zwischen Client und Server.
 * Diese Typen bilden die Daten ab, wie sie zwischen App und Backend ausgetauscht werden –
 * nicht zwingend 1:1 die ChurchTools-Rohdaten (die werden im Server gemappt).
 */

/** Ein Gottesdienst / Event in der Agenda. */
export interface Service {
  id: number;
  /** Tag (zweistellig), z.B. "08" */
  day: string;
  /** Monatskürzel, z.B. "Jun" */
  month: string;
  weekday: string;
  name: string;
  /** Untertitel des Termins (z.B. „Kennenlernabend"), falls gepflegt */
  subtitle: string | null;
  /** ISO-Datum (für Gruppierung/Logik), z.B. "2026-06-28" */
  date: string;
  /** Volles ISO-Startdatum inkl. Uhrzeit – Sortierschlüssel (Tie-Break bei gleichem Tag) */
  start: string;
  time: string;
  location: string;
  /** Anzahl Songs in der Setlist */
  songCount: number;
  /**
   * true, wenn sich die Setlist (Lieder/Reihenfolge/Tonart) geändert hat, seit dieses Konto den
   * Termin zuletzt geöffnet hat (#143). Konto-bezogen, serverseitig ermittelt. Nie geöffnete
   * Termine sind `false` (kein Fehlalarm bei Erstnutzung).
   */
  setlistChanged: boolean;
}

/** Ein Song innerhalb einer Setlist (aufgelöstes Arrangement). */
export interface SetlistSong {
  /** Song-ID in ChurchTools */
  id: number;
  /** Arrangement-ID in ChurchTools */
  arrangementId: number;
  /** Name des geltenden Arrangements („Band", „Akustik" …) – Teil der Info-Zeile (#320). */
  arrangementName: string;
  /**
   * Wie viele Arrangements hat das Lied insgesamt?
   *
   * Damit entscheidet die Anzeige, ob überhaupt etwas zu zeigen ist: Bei genau einem Arrangement ist
   * der Name keine Auskunft, sondern Lärm auf einem Blatt, das im Gottesdienst gelesen wird. Die
   * Zahl kommt mit, damit dafür kein zweiter Abruf nötig ist.
   */
  arrangementCount: number;
  title: string;
  author: string;
  /** Standardtonart der .chordpro-Datei */
  originalKey: string;
  /** In ChurchTools hinterlegte Zieltonart */
  targetKey: string;
  bpm: number | null;
  timeSig: string | null;
  ccli: string | null;
  /** Roher ChordPro-Inhalt der Originaldatei (SongSelect-Dialekt oder Standard) */
  chordpro: string;
  /**
   * `true`, wenn mindestens eine Akkord-Datei dieses Lieds **nicht geladen werden konnte** (#274) –
   * Zeitüberschreitung, Serverfehler, Netzproblem. Dann ist `chordpro` bzw. ein Versionstext leer,
   * OHNE dass das Lied wirklich leer ist.
   *
   * Vorher wurde jeder Download-Fehler zu einem leeren Text: Das Blatt blieb leer und das Lied fiel
   * stillschweigend aus der Sammel-PDF. Ein echtes 404 (Datei in ChurchTools gelöscht) setzt dieses
   * Kennzeichen NICHT – da ist leer die Wahrheit.
   *
   * Ein Kennzeichen für das ganze Lied genügt bewusst: Die Handlung ist in jedem Fall dieselbe
   * („später erneut versuchen"), eine Aufschlüsselung je Version brächte dem Nutzer nichts.
   */
  chordproFailed?: boolean;
  /**
   * Zusätzliche benannte Versionen (eigene .chordpro-Dateien im Arrangement, vom Team gepflegt).
   * Das Original ist NICHT enthalten – es wird im Client als feste erste Auswahl „Original" geführt.
   */
  versions: SongVersion[];
  /** Anzeigbare Dokumente des Arrangements (PDF / Bild) */
  documents: SongDocument[];
}

/** Eine benannte ChordPro-Version eines Lieds (zusätzlich zum Original). */
export interface SongVersion {
  /** Stabiler Schlüssel (Slug des Namens) – für Speicherung von Einstellungen/Anmerkungen. */
  key: string;
  /** Anzeigename, z. B. „Akustik". */
  name: string;
  /** Roher ChordPro-Inhalt dieser Version. */
  text: string;
}

/** Ein Arrangement zur Auswahl bei der Songsuche. */
export interface SongArrangementOption {
  arrangementId: number;
  arrangementName: string;
  key: string | null;
}

/** Ein Eintrag der „Alle Lieder"-Bibliothek (ein Song mit Standard-Arrangement). */
export interface SongLibraryEntry {
  songId: number;
  name: string;
  author: string | null;
  /** Tonart des Standard-Arrangements */
  key: string | null;
  arrangementId: number;
}

/**
 * Eine Lied-Kategorie, wie die App sie zur Auswahl anbietet (#322).
 *
 * **Immer schon zugeschnitten:** Der Server liefert nur die Kategorien, die das ChurchTools-Recht des
 * Nutzers zum Bearbeiten hergibt (`edit songcategory` nennt die erlaubten IDs). Eine Auswahl, die
 * Kategorien anbietet, die ChurchTools danach ablehnt, wäre ein Knopf ins Leere.
 *
 * `id` ist hier eine **Zahl** – die alte ChurchTools-Schnittstelle liefert sie als Zeichenkette
 * (`"0"`), das wird beim Einlesen umgewandelt. Ein Typ, der beides zulässt, hätte irgendwann einen
 * Vergleich `"0" === 0` in sich.
 */
export interface SongCategory {
  id: number;
  name: string;
}

/**
 * Die Art einer Arrangement-Datei (#321) – nur für das Symbol in der Liste.
 *
 * **Kein Sortier- oder Schutzmerkmal.** Die Liste ist bewusst flach und behandelt alle Dateien
 * gleich (Entscheidung Alwin, 11.08.2026); die Art sagt nur, was für ein Symbol davorsteht und
 * welche Folge die Rückfrage vor dem Löschen nennt.
 */
export type ArrangementFileKind =
  | 'chordpro-original'
  | 'chordpro-version'
  | 'pdf'
  | 'image'
  | 'other';

/** Eine Datei eines Arrangements, wie die Dateiverwaltung sie zeigt (#321). */
export interface ArrangementFileEntry {
  fileId: number;
  name: string;
  /**
   * Sprechende Bezeichnung für die Liste – **vom Server gebildet, nicht vom Client** (#321).
   *
   * Bei einer verwalteten Version ist es ihr Name („Version „Akustik""), beim Original „Notenblatt
   * (ChordPro)", sonst der Dateiname selbst.
   *
   * Warum der Server: Den Versionsnamen liest `versionNameOf` aus dem `(App)`-Marker im Dateinamen.
   * Diese Grammatik im Client ein zweites Mal auseinanderzunehmen wäre genau die Dopplung, die in
   * diesem Projekt am häufigsten schiefgegangen ist – sie steht bereits an mehreren Stellen und
   * kennt Altlasten (`(ECG)`, „Bearbeitet"), die man beim Abschreiben verliert.
   */
  label: string;
  /** Größe in Bytes – `null`, wenn ChurchTools sie nicht mitliefert. */
  size: number | null;
  kind: ArrangementFileKind;
}

/**
 * Ein Treffer aus CCLI SongSelect (#322) – über ChurchTools abgefragt.
 *
 * **Bewusst schmal:** Die Antwort von CCLI enthält auch die Konto-Nummer der Gemeinde, interne IDs
 * und Links zur CCLI-API. Nichts davon gehört in den Browser.
 */
export interface SongSelectTreffer {
  songNumber: number;
  title: string;
  authors: string[];
  /** Tonart laut CCLI – `null`, wenn dort keine hinterlegt ist (kommt vor). */
  defaultKey: string | null;
  isPublicDomain: boolean;
  /**
   * Verfügbar heißt: bei CCLI **vorhanden UND** von der Lizenz der Gemeinde **abgedeckt**.
   * Ein Knopf für etwas, das CCLI dann verweigert, führt ins Leere.
   */
  hasLyrics: boolean;
  hasChordPro: boolean;
  hasChordSheet: boolean;
}

/** Ein per CCLI-Nummer abgefragtes Lied – wie ein Treffer, plus Copyright fürs Anlegen. */
export interface SongSelectSong extends SongSelectTreffer {
  copyright: string | null;
}

/** Ein anzeigbares Dokument (PDF oder Bild) eines Arrangements. */
export interface SongDocument {
  fileId: number;
  name: string;
  type: 'pdf' | 'image';
}

/** Komplette Setlist eines Gottesdienstes. */
export interface Setlist {
  service: Service;
  songs: SetlistSong[];
}

/** Ein einzelner Punkt im Ablaufplan – Lied, Überschrift oder sonstiger Eintrag. */
export interface AgendaItem {
  /** ID des Agenda-Eintrags in ChurchTools */
  id: number;
  title: string;
  /** ChurchTools-Typ des Punkts (z.B. 'song', 'header', 'normal'); null wenn unbekannt */
  type: string | null;
  /** true, wenn es eine Überschrift / ein Abschnitt ist */
  isHeader: boolean;
  /** Zuständige: zugesagte Personen (besetzt) + Dienstnamen offener Plätze (open), dedupliziert. */
  responsible: ResponsibleEntry[];
  /** Roher responsible-Text (z.B. „[Musik], [Predigt]") – für die Bearbeitung im Editor. */
  responsibleText: string;
  /** Song-Daten, falls dieser Punkt ein Lied ist – sonst null */
  song: SetlistSong | null;
  /** Von ChurchTools berechnete Startuhrzeit in deutscher Ortszeit (z.B. „11:05"); null wenn keine. */
  time: string | null;
  /** Dauer des Punkts in Minuten (aus CT-Sekunden gerundet); null/0 wenn nicht gepflegt. */
  durationMin: number | null;
  /** Notiz/Beschreibung des Punkts (frei, kann leer sein). */
  note: string;
  /**
   * true, wenn dieser Punkt neu/geändert/verschoben ist gegenüber dem Stand, den das Konto zuletzt
   * gesehen hat (#161) – der Client lässt ihn dann kurz aufleuchten. `undefined`, wenn kein
   * Vergleichsstand existiert (nie geöffnet) oder der Abruf ohne Diff lief.
   */
  changed?: boolean;
  /**
   * true bei einem PLATZHALTER für einen seit dem letzten Ansehen ENTFERNTEN Punkt (#161 Etappe B):
   * steht an der alten Position, der Client blendet ihn kurz ein und lässt ihn auflösen. Solche
   * Einträge sind nicht mehr Teil des echten Ablaufs (kein Lied, nicht anklickbar).
   */
  removed?: boolean;
}

/** Ein Eintrag der Zuständigen-Anzeige: Personenname (besetzt) oder offener Dienst-Platz. */
export interface ResponsibleEntry {
  /** Anzeigename: Personenname oder Dienstname (z.B. „Musik"). */
  label: string;
  /** true = offener Dienst-Platz (noch niemand zugesagt) – wird hervorgehoben. */
  open: boolean;
}

/** Ein ChurchTools-Dienst (z.B. „Musik", „Predigt") – als Chip im Verantwortlich-Editor. */
export interface AgendaServiceOption {
  id: number;
  name: string;
}

/** Eine geparste ChordPro-Sektion (Vers, Chorus, …). */
export interface ChordProSection {
  type: string;
  label: string;
  lines: string[];
}

/** Was der angemeldete Nutzer laut ChurchTools darf (steuert die sichtbare UI). */
export interface UserCapabilities {
  canViewSongs: boolean;
  canViewAgendas: boolean;
  canEditAgendas: boolean;
  canEditSongs: boolean;
  /** ChurchTools-Administrator? Steuert Zugriff auf die Branding-Einstellungen. */
  isAdmin: boolean;
  /**
   * Darf Team-Notizen nutzen (eigene Anmerkungen teilen + geteilte Anmerkungen anderer ansehen) –
   * aktives Mitglied einer freigegebenen Gruppe mit freigegebener Rolle.
   */
  canUseGlobalNotes: boolean;
  /**
   * Darf CCLI SongSelect nutzen (#322) – aus dem ChurchTools-Recht `use ccli`.
   *
   * Getrennt von `canEditSongs`: Lieder bearbeiten zu dürfen heißt nicht, dass die Gemeinde eine
   * SongSelect-Lizenz hat. Ohne dieses Recht erscheint der Einstieg gar nicht erst – ein Knopf, der
   * immer scheitert, ist schlimmer als keiner.
   */
  canUseCcli: boolean;
}

/** Antwort des Login-Endpunkts. */
export interface AuthStatus {
  authenticated: boolean;
  user?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

/** Frei konfigurierbarer externer Link (z. B. zu einem anderen Gemeinde-Angebot). */
export interface SiteLink {
  /** Stabile ID (für React-Keys und Umsortieren). */
  id: string;
  /** Sichtbarer Button-/Zeilentext. */
  label: string;
  /** Zieladresse – nur http(s). */
  url: string;
  /** Zusätzlich auf der Login-Seite anzeigen (sonst nur im „Mehr"-Tab). */
  showOnLogin: boolean;
}

/**
 * Feste ChurchTools-Version: Aussehen (Farben/Logo) ist fix. Veränderbar bleibt
 * nur der Name der Gemeinde (Admin, über die Einstellungen). Wird vom Server aus
 * `site.json` gelesen/geschrieben.
 */
export interface SiteConfig {
  /** Voller App-Name (fest). */
  appName: string;
  /** Beschreibung (fest). */
  description: string;
  /** Name der Gemeinde/Organisation – einziger anpassbarer Wert. */
  orgName: string;
  /** Frei konfigurierbare externe Links (Mehr-Tab; optional auch Login-Seite). */
  links: SiteLink[];
  /**
   * Ausgewählte ChurchTools-Gruppen für globale Anmerkungen (UI-Label „Gruppen-Zuweisung" unter
   * Verwaltung → Anmerkungen; Mehrfachauswahl aus `GET /api/groups`). Reine Gruppen-Auswahl macht
   * NOCH KEIN Recht auf – erst die je Gruppe angehakten Rollen in `noteRoles` gewähren Sehen/Verwalten.
   * Leeres Array = Funktion komplett aus (nur private Anmerkungen).
   */
  musicianGroupIds: number[];
  /**
   * Rollen-Freigabe JE Gruppe (aus `musicianGroupIds`): welche `groupTypeRoleId`s dürfen
   * Team-Notizen NUTZEN (eigene teilen + geteilte ansehen). WICHTIG: leere Liste bzw. kein
   * Eintrag = NIEMAND (kein „alle"); erst das Anhaken einer Rolle gewährt das Recht. Vom Admin
   * im Mehr-Tab unter „Anmerkungen → Rollen-Zuweisung" gepflegt.
   */
  noteRoles?: NoteRolePerm[];
}

/** Rollen-Freigabe einer Gruppe für Team-Notizen (siehe `SiteConfig.noteRoles`). */
export interface NoteRolePerm {
  /** ChurchTools-Gruppen-ID (muss in `musicianGroupIds` enthalten sein). */
  groupId: number;
  /** Erlaubte `groupTypeRoleId`s. Leer = NIEMAND (in dieser Gruppe). */
  roles: number[];
}

/** Info zur neuesten veröffentlichten Version – für den dezenten Update-Hinweis in der App. */
export interface UpdateInfo {
  /** Neueste Version als reine Nummer ohne „v" (z. B. „2.3.0"); null wenn unbekannt. */
  latest: string | null;
  /** Original-Tag-Name des Releases (z. B. „v2.3.0"); null wenn unbekannt. */
  tag: string | null;
  /** Link zur Release-Note auf GitHub; null wenn unbekannt. */
  url: string | null;
}

// ── Anmerkungen (Striche + Textfelder + Zoom) ─────────────────────────────────
// EINZIGE Quelle dieser Typen: Client (services/annotations.ts, teamNotes.ts) und
// Server (services/annotations.ts) importieren von hier. Das Zod-Schema in
// annotationsController.ts wird per Compile-Wächter gegen diese Typen geprüft, damit
// beim Speichern kein Feld stillschweigend weggeschnitten wird (s. #115).

/** Ein frei platziertes Textfeld einer Anmerkung auf dem Chart. */
export interface AnnotationText {
  id: number;
  fx: number;
  fy: number;
  text: string;
  color: string;
  sizeCqh: number;
  // Absatz-Format (optional; ältere Anmerkungen kennen es nicht). MUSS end-to-end mitlaufen,
  // sonst geht es beim Server-Roundtrip verloren → normaler Text würde wieder fett (#115).
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
}

/** Anmerkungen einer Seite, pro Konto gespeichert: Striche (PNG-DataURL) + Texte + Zoom. */
export interface PageAnnotation {
  /** Striche als PNG-DataURL (oder null = keine). */
  strokes?: string | null;
  texts?: AnnotationText[];
  /** Gespeicherter Zoom der Seite. */
  zoom?: { x: number; y: number; scale: number } | null;
}

/** Geteilte (fremde) Anmerkungsebene beim Ansehen – wie PageAnnotation, aber ohne Zoom. */
export type SharedPage = Pick<PageAnnotation, 'strokes' | 'texts'>;

/** Standardwerte. `appName`/`description` sind fest; `orgName`/`links` sind anpassbar. */
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  appName: 'Churchtools Musik App',
  description: 'Chord Charts aus ChurchTools',
  orgName: 'Meine Gemeinde',
  links: [],
  musicianGroupIds: [],
};
