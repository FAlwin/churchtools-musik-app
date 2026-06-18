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
  /** ISO-Datum (für Sortierung/Logik) */
  date: string;
  time: string;
  location: string;
  /** Anzahl Songs in der Setlist */
  songCount: number;
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
  /** Bearbeitete ECG-Version, falls vorhanden (separate .chordpro-Datei) */
  chordproEcg: string | null;
  /** Anzeigbare Dokumente des Arrangements (PDF / Bild) */
  documents: SongDocument[];
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
 * Laufzeit-Branding einer Instanz (White-Label). Wird vom Server aus `site.json`
 * gelesen/geschrieben und vom Client beim Start angewendet. Eine fremde Gemeinde
 * stellt diese Werte über die Einstellungsseite ein – kein Neubau nötig.
 */
export interface SiteConfig {
  /** Voller App-Name (PWA-Manifest, Titel). */
  appName: string;
  /** Kurzname (Home-Bildschirm). */
  shortName: string;
  /** Beschreibung im Manifest. */
  description: string;
  /** Name der Gemeinde/Organisation (Login-Untertitel). */
  orgName: string;
  /** Logo als Data-URL (base64) oder null = mitgeliefertes Standard-Logo. */
  logoDataUrl: string | null;
  /** Hauptfarbe (Teal-Ersatz) als Hex. */
  primaryColor: string;
  /** Akkordfarbe (Orange-Ersatz) als Hex. */
  accentColor: string;
  /** CCLI-Lizenznummer der Gemeinde oder null. */
  ccli: string | null;
}

/** Standard-Branding (ECG Donrath) – Fallback, solange nichts eingestellt ist. */
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  appName: 'Churchtools Musik App',
  shortName: 'Churchtools Musik App',
  description: 'Chord Charts aus ChurchTools',
  orgName: 'ECG Donrath',
  logoDataUrl: null,
  primaryColor: '#00616E',
  accentColor: '#EB5E28',
  ccli: '2395145',
};
