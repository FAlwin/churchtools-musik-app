/**
 * Konkrete Backend-Endpunkte der Worship-App. Alle UI-Datenzugriffe laufen hierüber.
 */
import type {
  AgendaItem,
  AgendaServiceOption,
  ArrangementFileEntry,
  AuthStatus,
  LiedAngelegt,
  LiedAnlegenAuftrag,
  LiedStammdaten,
  LiedStammdatenAnsicht,
  Service,
  SetlistSong,
  SongArrangementOption,
  SongCategory,
  SongLibraryEntry,
  SongSelectSong,
  SongSelectSuchergebnis,
  SongTextTreffer,
  LiedtextVorschau,
  SongSelectLiedtext,
  SongVersion,
  UserCapabilities,
} from '@shared/types/index';
import { apiFetch, apiFetchBlob } from './api';

export function login(email: string, password: string): Promise<AuthStatus> {
  return apiFetch<AuthStatus>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<AuthStatus> {
  return apiFetch<AuthStatus>('/api/auth/logout', { method: 'POST' });
}

export function getMe(): Promise<AuthStatus> {
  return apiFetch<AuthStatus>('/api/auth/me');
}

/** Rechte des angemeldeten Nutzers (steuert die sichtbare UI). */
export async function getCapabilities(): Promise<UserCapabilities> {
  const caps = await apiFetch<UserCapabilities>('/api/capabilities');
  // ChurchTools liefert sporadisch alle Rechte-Zuordnungen leer (Struktur da, Werte []), obwohl
  // der Nutzer Zugriff hat. Das als transienten Fehler werfen → useCapabilities versucht
  // automatisch neu; hält es an, zeigt App.tsx den Fehlerschirm mit „Erneut versuchen".
  if (!caps.canViewSongs && !caps.canViewAgendas) {
    throw new Error('Berechtigungen wurden unvollständig geladen – bitte erneut versuchen.');
  }
  return caps;
}

export function getServices(range?: { from?: string; to?: string }): Promise<Service[]> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return apiFetch<Service[]>(`/api/services${qs ? `?${qs}` : ''}`);
}

/** Alle Ablaufpunkte eines Gottesdienstes (Lieder inkl. ChordPro). */
export function getAgenda(eventId: number): Promise<AgendaItem[]> {
  return apiFetch<AgendaItem[]>(`/api/services/${eventId}/setlist`);
}

/** Merkt den aktuellen Setlist-Stand als „gesehen" → entfernt das „geändert"-Badge (#143). */
export function markSetlistSeen(eventId: number): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/services/${eventId}/seen`, { method: 'POST' });
}

/** Aktueller Ablauf-Fingerabdruck (Live-Abgleich: billig, ohne ChordPro-Downloads). */
export function getSetlistVersion(eventId: number): Promise<{ hash: string }> {
  return apiFetch<{ hash: string }>(`/api/services/${eventId}/setlist/version`);
}

/** Speichert die neue Reihenfolge der Ablaufpunkte (Liste der Item-IDs in Wunschreihenfolge). */
export function reorderAgenda(eventId: number, order: number[]): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/order`, {
    method: 'PATCH',
    body: JSON.stringify({ order }),
  });
}

/** Legt einen neuen Ablaufpunkt an (Text/Überschrift/Lied). */
export function createAgendaItem(
  eventId: number,
  data: {
    type: 'header' | 'text' | 'song';
    title?: string;
    arrangementId?: number;
    responsible?: string;
    note?: string;
    durationMin?: number;
  },
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/items`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Lädt die ChurchTools-Dienste (für die Verantwortlich-Chips). */
export function getAgendaServices(): Promise<AgendaServiceOption[]> {
  return apiFetch<AgendaServiceOption[]>('/api/agenda-services');
}

/**
 * Änderbare Felder eines Ablaufpunkts – gesammelt in EINEM Request (der Server akzeptiert alle
 * zusammen). `arrangementId` verknüpft ein Lied, `unlink` hebt die Verknüpfung auf (beides
 * schließt sich aus); `unlink` + `title` zusammen = aufheben und direkt umbenennen.
 */
export interface AgendaItemUpdate {
  title?: string;
  arrangementId?: number;
  unlink?: boolean;
  responsible?: string;
  durationMin?: number;
  note?: string;
}

/** Schreibt die geänderten Felder eines Ablaufpunkts gesammelt (ein PUT statt Request pro Feld). */
export function updateAgendaItem(
  eventId: number,
  itemId: number,
  fields: AgendaItemUpdate,
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

/** Blendet die Uhrzeit eines Punkts in ChurchTools aus/ein (durchgestrichenes Auge). */
export function setAgendaItemHidden(
  eventId: number,
  itemId: number,
  hidden: boolean,
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}/hidden`, {
    method: 'PUT',
    body: JSON.stringify({ hidden }),
  });
}

/** Alle Lieder (für die „Alle Lieder"-Ansicht) – ohne Statistik (lädt schnell). */
export function getSongLibrary(): Promise<SongLibraryEntry[]> {
  return apiFetch<SongLibraryEntry[]>('/api/song-library');
}

/**
 * Die Lied-Kategorien, in denen der Nutzer anlegen/ändern darf (#322).
 *
 * Der Server schneidet die Liste bereits am ChurchTools-Recht zu – hier wird **nicht** noch einmal
 * gefiltert. Zwei Filter über dieselbe Regel wären zwei Stellen, die auseinanderlaufen können.
 */
export function getSongCategories(): Promise<SongCategory[]> {
  return apiFetch<SongCategory[]>('/api/song-categories');
}

/**
 * Im **Liedtext** des eigenen Bestands suchen (#322).
 *
 * Beim ersten Aufruf baut der Server dafür einen Index (ein Datei-Download je Lied) – das dauert
 * spürbar, danach kommt die Antwort aus dem Speicher. Gemessen: Weder ChurchTools noch CCLI können im
 * Liedtext suchen, deshalb macht es unser Server selbst (siehe `songTextIndex.ts`).
 */
export function sucheImLiedtext(q: string): Promise<SongTextTreffer[]> {
  return apiFetch<SongTextTreffer[]>(`/api/song-text-search?q=${encodeURIComponent(q)}`);
}

/**
 * Den Textanfang **eines** Liedes holen (#379) – für die Vorschau bei gleichnamigen Liedern.
 *
 * Baut den Suchindex **nicht**: Steht er beim Server frisch, kommt die Antwort daraus; sonst lädt er
 * genau dieses eine Notenblatt. Deshalb ist der Aufruf je Lied vertretbar – anders als ein
 * Index-Aufbau, der ~50 Downloads kostet.
 */
export function holeLiedtextVorschau(songId: number): Promise<LiedtextVorschau> {
  return apiFetch<LiedtextVorschau>(`/api/songs/${songId}/liedtext-vorschau`);
}

/**
 * Den Liedtext eines **SongSelect**-Liedes holen (#379) – die Vorschau vor dem Anlegen.
 *
 * **Nur beim bewussten Öffnen eines Treffers**, nie beim Durchsehen: Ob CCLI den Abruf als Nutzung
 * verbucht, ist offen (gemessen wurde nur, dass die Antwort keinen Hinweis darauf enthält). Der Hook
 * darüber speichert je Nummer zwischen.
 */
export function holeSongSelectLiedtext(songNumber: number): Promise<SongSelectLiedtext> {
  return apiFetch<SongSelectLiedtext>(`/api/songselect/songs/${songNumber}/liedtext`);
}

/**
 * Bei CCLI SongSelect nach einem Titel suchen (#322) – über ChurchTools als Vermittler.
 *
 * **Die Trefferliste ist nicht unbedingt vollständig:** ChurchTools holt 100 Treffer und zeigt keinen
 * Weg weiter (gemessen: 147 zu „Wo ich auch stehe"). Die Oberfläche sagt das, statt Vollständigkeit
 * vorzutäuschen.
 */
export function sucheSongSelect(title: string): Promise<SongSelectSuchergebnis> {
  return apiFetch<SongSelectSuchergebnis>(
    `/api/songselect/search?title=${encodeURIComponent(title)}`,
  );
}

/** Ein CCLI-Lied per Nummer abfragen (#322) – liefert zusätzlich das Copyright fürs Formular. */
export function getSongSelectSong(songNumber: number): Promise<SongSelectSong> {
  return apiFetch<SongSelectSong>(`/api/songselect/songs/${songNumber}`);
}

/**
 * Die Stammdaten eines Liedes lesen (#322, Schritt 11) – für das Änderungsformular.
 *
 * **Nicht aus der Bibliothek:** `SongLibraryEntry` kennt CCLI-Nummer, Copyright und Kategorie nicht.
 * Sie dort mitzuschleppen hieße, sie in jeder Liedliste zu laden, obwohl kein Bildschirm sie anzeigt.
 */
export function getSongStammdaten(songId: number): Promise<LiedStammdatenAnsicht> {
  return apiFetch<LiedStammdatenAnsicht>(`/api/songs/${songId}/stammdaten`);
}

/**
 * Stammdaten ändern (#322, Schritt 11) – **nur die geänderten Felder.**
 *
 * Der Server macht daraus ein vollständiges `PUT` (lesen–ändern–schreiben), weil ChurchTools bei einem
 * Teil-`PUT` die nicht gesendeten Felder löscht. Zurück kommt, was danach wirklich drinsteht.
 */
export function aendereLied(
  songId: number,
  aenderung: Partial<LiedStammdaten>,
): Promise<LiedStammdatenAnsicht> {
  return apiFetch<LiedStammdatenAnsicht>(`/api/songs/${songId}`, {
    method: 'PUT',
    body: JSON.stringify(aenderung),
  });
}

/**
 * Ein Lied löschen (#322, Schritt 11) – **samt allem, was daran hängt.**
 *
 * Die Rückfrage steht in der Oberfläche und nennt die Folgen. Zurück kommt der Name, weil es ihn danach
 * nicht mehr gibt, die Meldung ihn aber braucht.
 */
export function loescheLied(songId: number): Promise<{ name: string }> {
  return apiFetch<{ name: string }>(`/api/songs/${songId}`, { method: 'DELETE' });
}

/**
 * Ein neues Lied anlegen (#322) – Lied + erstes Arrangement, auf Wunsch samt Ablauf-Eintrag.
 *
 * **Rechte, Kategorie und die CCLI-Doppelprüfung macht der Server**, nicht das Formular: Eine Prüfung,
 * die nur in der Oberfläche steht, umgeht jeder, der den Endpunkt direkt aufruft. Die Antwort nennt
 * auch den Teilerfolg (`imAblauf: false`) – die Oberfläche gibt ihn als Text weiter.
 */
export function legeLiedAn(auftrag: LiedAnlegenAuftrag): Promise<LiedAngelegt> {
  return apiFetch<LiedAngelegt>('/api/songs', {
    method: 'POST',
    body: JSON.stringify(auftrag),
  });
}

/**
 * Nutzungsdaten je Song: die vergangenen Spieltermine (YYYY-MM-DD, absteigend). Häufigkeit und
 * „zuletzt" für einen gewählten Zeitraum rechnet die Ansicht daraus selbst aus – separat, gecacht.
 */
export type SongUsageMap = Record<string, { dates: string[] }>;
export function getSongUsage(): Promise<SongUsageMap> {
  return apiFetch<SongUsageMap>('/api/song-usage');
}

/** Arrangements eines bekannten Lieds (für „Zu Ablauf hinzufügen"). */
export function getSongArrangements(songId: number): Promise<SongArrangementOption[]> {
  return apiFetch<SongArrangementOption[]>(`/api/songs/${songId}/arrangements`);
}

/** Chart-Daten eines einzelnen Lieds. */
export function getSongChart(songId: number, arrangementId?: number): Promise<SetlistSong> {
  const qs = arrangementId ? `?arrangementId=${arrangementId}` : '';
  return apiFetch<SetlistSong>(`/api/songs/${songId}/chart${qs}`);
}

/**
 * Die Dateien eines Arrangements – ALLE, flach (#321).
 *
 * Anders als `song.documents`, das nur die anzeigbaren PDFs/Bilder meint: Hier sind auch ChordPro,
 * die verwalteten Versionen und alles Übrige dabei.
 */
export function getArrangementFiles(
  songId: number,
  arrangementId: number,
): Promise<ArrangementFileEntry[]> {
  return apiFetch<ArrangementFileEntry[]>(
    `/api/songs/${songId}/arrangements/${arrangementId}/files`,
  );
}

/**
 * Eine Datei aus ChurchTools als Bytes holen (#321) – zum Herunterladen aufs Gerät.
 *
 * Derselbe Endpunkt, über den auch der Dokumenten-Betrachter liest; er prüft die Ziel-URL gegen die
 * eigene Instanz (#199).
 */
export function getSongFileBlob(songId: number, fileId: number): Promise<Blob> {
  return apiFetchBlob(`/api/songs/${songId}/files/${fileId}`);
}

/**
 * Eine Datei an ein Arrangement hängen (#321) – gibt die frische Liste zurück.
 *
 * **Roher Rumpf, kein Multipart:** Die Datei geht unverändert als Body, ihre Art über
 * `Content-Type`, der Name über `?name=`. Der Server setzt daraus das Multipart für ChurchTools
 * zusammen. So braucht keine Seite eine Bibliothek zum Zerlegen von Multipart.
 *
 * Der `Content-Type` wird ausdrücklich gesetzt: `apiFetch` schreibt sonst bei jedem Rumpf
 * `application/json` – ein PDF käme dann als JSON deklariert an.
 */
export function uploadArrangementFile(
  songId: number,
  arrangementId: number,
  datei: File,
): Promise<ArrangementFileEntry[]> {
  return apiFetch<ArrangementFileEntry[]>(
    `/api/songs/${songId}/arrangements/${arrangementId}/files?name=${encodeURIComponent(datei.name)}`,
    {
      method: 'POST',
      body: datei,
      headers: { 'Content-Type': datei.type || 'application/octet-stream' },
    },
  );
}

/**
 * Das Notenblatt aus CCLI SongSelect ins Arrangement holen (#322).
 *
 * **Ersetzt ein vorhandenes Original-ChordPro** – pro Arrangement gehört genau eines hin, sonst
 * entscheidet die Reihenfolge von ChurchTools, welche Tonart angezeigt wird. Gibt die frische
 * Dateiliste zurück.
 */
export function holeChordProAusSongSelect(
  songId: number,
  arrangementId: number,
  songNumber: number,
): Promise<ArrangementFileEntry[]> {
  return apiFetch<ArrangementFileEntry[]>(
    `/api/songs/${songId}/arrangements/${arrangementId}/songselect/chordpro`,
    { method: 'POST', body: JSON.stringify({ songNumber }) },
  );
}

/** Löscht eine Datei des Lieds (#321). Der Server prüft, dass sie wirklich zu ihm gehört. */
export function deleteSongFile(songId: number, fileId: number): Promise<void> {
  return apiFetch<void>(`/api/songs/${songId}/files/${fileId}`, { method: 'DELETE' });
}

/** Löscht einen Ablaufpunkt. */
export function deleteAgendaItem(eventId: number, itemId: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}`, { method: 'DELETE' });
}

/** Legt eine neue benannte Version eines Songs in ChurchTools an. */

export function createVersion(
  songId: number,
  arrangementId: number,
  name: string,
  text: string,
): Promise<SongVersion> {
  return apiFetch(`/api/songs/${songId}/versions`, {
    method: 'POST',
    body: JSON.stringify({ arrangementId, name, text }),
  });
}

/** Aktualisiert Text und/oder Namen einer Version. */
export function updateVersion(
  songId: number,
  arrangementId: number,
  versionKey: string,
  changes: { text?: string; name?: string },
): Promise<SongVersion> {
  return apiFetch(`/api/songs/${songId}/versions/${encodeURIComponent(versionKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ arrangementId, ...changes }),
  });
}

/** Löscht eine benannte Version (das Original bleibt erhalten). */
export function deleteVersion(
  songId: number,
  arrangementId: number,
  versionKey: string,
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/songs/${songId}/versions/${encodeURIComponent(versionKey)}`, {
    method: 'DELETE',
    body: JSON.stringify({ arrangementId }),
  });
}

/**
 * Setzt das Tempo eines Arrangements in ChurchTools.
 *
 * ⚠️ Das gilt für ALLE, die das Lied öffnen – auch rückwirkend für vergangene Gottesdienste. Anders
 * als die Anzeige-Einstellungen (Tonart, Spalten, Schrift), die bewusst persönlich bleiben.
 */
export function setArrangementTempo(
  songId: number,
  arrangementId: number,
  tempo: number,
): Promise<{ tempo: number }> {
  return apiFetch(`/api/songs/${songId}/arrangements/${arrangementId}/tempo`, {
    method: 'PUT',
    body: JSON.stringify({ tempo }),
  });
}
