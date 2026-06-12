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
  /** Wie oft in den letzten 12 Monaten im Ablauf verwendet */
  usageCount: number;
  /** ISO-Datum der letzten Verwendung (oder null) */
  lastUsed: string | null;
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
  /** Eingetragene Zuständige (nur besetzte Positionen) – nur Anzeige, in CT gepflegt. */
  responsible: string[];
  /** Song-Daten, falls dieser Punkt ein Lied ist – sonst null */
  song: SetlistSong | null;
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
