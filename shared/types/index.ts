/**
 * Geteilte Typen zwischen Client und Server.
 * Diese Typen bilden die Daten ab, wie sie zwischen App und Backend ausgetauscht werden –
 * nicht zwingend 1:1 die ChurchTools-Rohdaten (die werden im Server gemappt).
 */

/** Eine Person im Event-Dienstplan (Musik 1, Predigt, Ton …). */
export interface EventTeamMember {
  role: string;
  name: string;
  /** false = Anfrage noch offen / nicht bestätigt */
  agreed: boolean;
}

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
  /** ISO-Datum (für Sortierung/Logik) */
  date: string;
  time: string;
  location: string;
  /** Anzahl Songs in der Setlist */
  songCount: number;
  /** Zugeteilte Personen aus dem ChurchTools-Dienstplan */
  team: EventTeamMember[];
}

/** Ein Song innerhalb einer Setlist (aufgelöstes Arrangement). */
export interface SetlistSong {
  /** Song-ID in ChurchTools */
  id: number;
  /** Arrangement-ID in ChurchTools */
  arrangementId: number;
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

/** Ein Songsuche-Treffer mit seinen Arrangements. */
export interface SongSearchResult {
  songId: number;
  name: string;
  author: string | null;
  arrangements: SongArrangementOption[];
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

/**
 * Feste ChurchTools-Version: Aussehen (Farben/Logo) ist fix. Veränderbar bleibt
 * nur der Name der Gemeinde (Admin, über die Einstellungen). Wird vom Server aus
 * `site.json` gelesen/geschrieben.
 */
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

export interface SiteConfig {
  /** Voller App-Name (fest). */
  appName: string;
  /** Beschreibung (fest). */
  description: string;
  /** Name der Gemeinde/Organisation – einziger anpassbarer Wert. */
  orgName: string;
  /** Frei konfigurierbare externe Links (Mehr-Tab; optional auch Login-Seite). */
  links: SiteLink[];
}

/** Standardwerte. `appName`/`description` sind fest; `orgName`/`links` sind anpassbar. */
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  appName: 'Churchtools Musik App',
  description: 'Chord Charts aus ChurchTools',
  orgName: 'Meine Gemeinde',
  links: [],
};
