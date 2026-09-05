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
  /**
   * CCLI-Nummer, wie ChurchTools sie am Lied führt – `null`, wenn keine eingetragen ist (#378).
   *
   * Seit dem 04.09.2026 Teil der Bibliothekssuche: Wer „5841527" tippt und das Lied liegt schon bei
   * uns, soll es in der Bibliothek finden – nicht erst über SongSelect. Bewusst **pflichtig**, nicht
   * optional: Ein optionales Feld, das der Server vergisst, fällt niemandem auf; ein fehlendes
   * Pflichtfeld zeigt der Compiler.
   */
  ccli: string | null;
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
 * Die Stammdaten eines neuen Liedes (#322) – **die einzige Stelle, die diese Felder aufzählt.**
 *
 * Sie stehen hier und nicht im Server, weil das Formular sie füllt und ChurchTools sie annimmt: Eine
 * zweite Fassung im Client wäre die Regel-Dopplung, die dieses Projekt am häufigsten getroffen hat.
 * `server/services/ctWrite.ts` verwendet denselben Typ (`NeuesLied`).
 *
 * `note` fehlt mit Absicht: `POST /api/songs` ignoriert das Feld (gemessen 13.08.2026) – die Notiz
 * kommt über „Stammdaten ändern" (#322, Schritt 11).
 */
export interface LiedStammdaten {
  name: string;
  categoryId: number;
  author?: string;
  ccli?: string;
  copyright?: string;
}

/**
 * Die Feldgrenzen beim Anlegen eines Liedes (#322) – **eine Quelle für Formular und Zod-Schema.**
 *
 * Die Werte stammen von ChurchTools selbst (gemessen mit leerem Rumpf, 07.08.2026: Name 2–200
 * Zeichen). Sie stehen hier, weil beide Seiten sie brauchen: das Formular für `maxLength` und die
 * Freigabe des Knopfs, der Server zum Prüfen. Zweimal hingeschriebene Zahlen wären zwei Stellen, an
 * denen eine Korrektur landen muss – und die zweite wird vergessen.
 */
export const LIED_GRENZEN = {
  name: { min: 2, max: 200 },
  author: 200,
  ccli: 50,
  copyright: 500,
  key: 10,
  arrangementName: 50,
} as const;

/** Der Auftrag aus dem Formular „Neues Lied" (#322): Stammdaten + erstes Arrangement (+ Ablauf). */
export interface LiedAnlegenAuftrag extends LiedStammdaten {
  /** Tonart des ersten Arrangements (aus SongSelect vorbelegt, änderbar). */
  key?: string | null;
  /** Name des ersten Arrangements; leer = „Standard". */
  arrangementName?: string;
  /** Wenn gesetzt: das fertige Lied zusätzlich in den Ablauf dieses Termins eintragen. */
  eventId?: number;
}

/**
 * Die Stammdaten eines Liedes, wie die App sie anzeigt und zurückbekommt (#322, Schritt 11).
 *
 * **Eine Form für zwei Wege:** `GET /api/songs/:songId/stammdaten` liefert sie, und `PUT` antwortet mit
 * derselben Form – das, was danach wirklich in ChurchTools steht. Zwei verschiedene Formen für „so
 * sieht das Lied aus" wären zwei Stellen, die auseinanderlaufen.
 *
 * Leere Felder sind `null`, nicht `''`: Das ist der Zustand, den ChurchTools liefert, und die
 * Oberfläche macht daraus ein leeres Eingabefeld.
 */
export interface LiedStammdatenAnsicht {
  songId: number;
  name: string;
  author: string | null;
  ccli: string | null;
  copyright: string | null;
  /** `null`, wenn ChurchTools keine Kategorie mitliefert – dann lässt sich das Lied nicht speichern. */
  categoryId: number | null;
}

/**
 * Was beim Anlegen herauskam – **auch der Teilerfolg wird benannt**, nicht verschwiegen (#322).
 *
 * Ein Lied entsteht in zwei bis drei Schreibvorgängen ohne Transaktion (siehe
 * `server/services/songErstellen.ts`). Deshalb sagt die Antwort nicht nur „hat geklappt", sondern
 * auch, was davon: Ein fehlender Ablauf-Eintrag ist kein Grund, das angelegte Lied zu verschweigen.
 */
export interface LiedAngelegt {
  songId: number;
  arrangementId: number;
  /** Nur gesetzt, wenn ein Termin mitgegeben wurde: Hat der Ablauf-Eintrag geklappt? */
  imAblauf?: boolean;
  /** Warum der Ablauf-Eintrag nicht geklappt hat – für die Meldung an den Nutzer. */
  ablaufFehler?: string;
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

/**
 * Das Ergebnis einer SongSelect-Suche (#322) – **Treffer PLUS die Auskunft über Vollständigkeit.**
 *
 * Der Typ steht hier und nicht nur im Server, und das ist die Lehre aus einem Absturz vom 13.08.2026:
 * Der Client behauptete `SongSelectTreffer[]`, der Server lieferte dieses Objekt. `apiFetch<T>` ist über
 * die HTTP-Grenze nur eine **Behauptung** – TypeScript prüft dort nichts nach. Die Trefferliste rief
 * dann `.map` auf einem Objekt auf und die App zeigte den Fehlerschirm.
 *
 * `vollstaendig` beantwortet, ob noch mehr Treffer da wären: ChurchTools holt 100 auf einmal und kennt
 * keinen Weg zu weiteren Seiten (gemessen: 147 zu „Wo ich auch stehe"). **Diese Rechnung gehört nicht
 * in die Oberfläche** – dort stand vorher ein geratenes `treffer.length >= 100` daneben.
 */
export interface SongSelectSuchergebnis {
  treffer: SongSelectTreffer[];
  /** Wie viele Treffer CCLI insgesamt hat – auch die, die nicht mitkamen. */
  gesamt: number;
  vollstaendig: boolean;
}

/** Ein per CCLI-Nummer abgefragtes Lied – wie ein Treffer, plus Copyright fürs Anlegen. */
export interface SongSelectSong extends SongSelectTreffer {
  copyright: string | null;
}

/**
 * Ein Treffer der **Suche im Liedtext** (#322).
 *
 * Der Ausschnitt zeigt die Fundstelle – ohne ihn müsste man jedes Lied öffnen, um zu sehen, warum es
 * gefunden wurde. Er kommt aus dem Suchtext (kleingeschrieben, ohne Akkorde) und ist damit ehrlich:
 * So wurde gesucht.
 */
export interface SongTextTreffer {
  songId: number;
  name: string;
  ausschnitt: string;
}

/**
 * Ab wie vielen Zeichen im Liedtext gesucht wird – **die Zahl steht hier, weil beide Seiten sie
 * brauchen** (#378).
 *
 * Kürzere Begriffe treffen fast jedes Lied und wären nur Rauschen. Der Server prüft es ebenfalls: Eine
 * Grenze, die nur der Client zieht, umgeht jeder, der den Endpunkt direkt aufruft.
 *
 * **Sie stand vorher an vier Stellen** (`useServices`, zweimal `AllSongs`, `songTextIndex`) – jede eine
 * eigene `3`. Beim Umbau auf den Quellen-Umschalter wäre eine fünfte dazugekommen; wer die Grenze
 * später anhebt, hätte vier davon gefunden und eine vergessen.
 */
export const LIEDTEXT_SUCHE_MIN_ZEICHEN = 3;

/**
 * Die Antwort auf `GET /api/songs/:songId/liedtext-vorschau` (#379).
 *
 * **Ein Objekt, keine nackte Zeichenkette** – und `vorschau: null` ist ein eigener, gültiger Fall: „Dieses
 * Lied hat keinen Text." Die Oberfläche zeigt dann gar keine Vorschau, statt eine leere.
 *
 * Der Typ steht hier und nicht im Client, weil er über die **HTTP-Grenze** geht: Dort prüft TypeScript
 * nichts nach – `apiFetch<T>` castet nur. Am 13.08.2026 hat genau das die App zum Absturz gebracht
 * (Client erwartete eine Liste, Server lieferte ein Objekt), und der Test war grün, weil sein Mock
 * dieselbe falsche Form hatte.
 */
export interface LiedtextVorschau {
  /**
   * Das **rohe ChordPro** des Original-Notenblatts – `null`, wenn das Lied keines hat (#379).
   *
   * Bis zum 04.09.2026 kam hier ein gekürzter Textanfang (220 Zeichen, eine Zeile). Alwin: „In der
   * Vorschau wäre es cool, wenn der ganze Text scrollbar sichtbar ist – manchmal braucht man genau den
   * Chorus, um auf das Lied zu kommen." Die Abschnitte (Vers, Chorus, Bridge) baut der **Client** mit
   * `parseChordPro` – demselben Parser, der auch das Blatt zerlegt. Ein zweiter Abschnitts-Parser auf
   * dem Server wäre dieselbe Regel zweimal.
   */
  chordpro: string | null;
}

/**
 * Ein Abschnitt eines Liedtexts von CCLI (#379) – `Vers 1`, `Chorus 1`, `Bridge`, …
 *
 * CCLI liefert den Text **strukturiert** (`lyricParts`), nicht als einen Block – gemessen am 14.08.2026.
 * Das wird durchgereicht, statt es plattzumachen: Mit den Beschriftungen liest man die Vorschau so, wie
 * das Lied aufgebaut ist, und erkennt zwei Fassungen desselben Titels schneller.
 */
export interface LiedtextTeil {
  /** Die Beschriftung von CCLI, z. B. „Vers 1" oder „Chorus 1". */
  label: string;
  text: string;
}

/**
 * Der Liedtext eines SongSelect-Liedes (#379) – die Entscheidungsgrundlage in der Vorschau.
 *
 * **`disclaimer` ist nicht schmückend, sondern Pflicht.** CCLI schickt ihn mit jedem Text mit („For use
 * solely with the SongSelect Terms of Use. All rights reserved. www.ccli.com", gemessen). Wer den Text
 * anzeigt, zeigt ihn mit – deshalb steht er im Typ und nicht als hübsche Beigabe im Client.
 */
export interface SongSelectLiedtext {
  songNumber: number;
  title: string;
  authors: string[];
  /** Erste Copyright-Zeile von CCLI, falls vorhanden. */
  copyright: string | null;
  teile: LiedtextTeil[];
  disclaimer: string | null;
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
  /**
   * Darf den Bereich „Verfügbarkeit" nutzen (#177) – aktives Mitglied einer der unter „Anmerkungen →
   * Gruppen-Zuweisung" gewählten Gruppen (`musicianGroupIds`), **ohne** Rollen-Filter: Die Rollen aus
   * `noteRoles` regeln nur, wer fremde Notizen sieht. Eigene Abwesenheiten darf jedes Teammitglied
   * pflegen. Leere Gruppenauswahl = Bereich aus.
   */
  canUseAvailability: boolean;
}

// ── Verfügbarkeit / Abwesenheiten (#177) ──────────────────────────────────
// Der generische Kern: nur ChurchTools-Abwesenheiten, kein Excel-Bezug (siehe
// docs/entwicklung/plan-verfuegbarkeit-phase1.md §12). Marker-Konvention in @shared/absences.

/** Eine Abwesenheit des angemeldeten Kontos, wie die App sie zeigt. */
export interface Absence {
  id: number;
  /** `YYYY-MM-DD`, einschließlich. */
  startDate: string;
  endDate: string;
  /** Freitext ohne Marker – für die Anzeige. */
  comment: string;
  /** Name des ChurchTools-Abwesenheitsgrunds (z. B. „Abwesend", „Urlaub"); null wenn unbekannt. */
  reason: string | null;
  /**
   * Von der App oder dem Sync angelegt (Kommentar trägt den Marker) → darf hier gelöscht werden.
   * Manuelle ChurchTools-Einträge werden angezeigt, aber nie angefasst.
   */
  eigene: boolean;
}

/** Was die App zum Anlegen schickt. Der Marker kommt serverseitig dazu. */
export interface NeueAbsence {
  startDate: string;
  endDate: string;
  comment?: string;
}

/** Ein kommender Termin als Schnellauswahl – Name und Tag reichen, um sich abzumelden. */
export interface AbsenceEvent {
  id: number;
  name: string;
  /** `YYYY-MM-DD` des Termintags. */
  date: string;
  /** ISO-Startzeitpunkt (für Uhrzeit und Sortierung). */
  startDate: string;
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
