/**
 * Konkrete Backend-Endpunkte der Worship-App. Alle UI-Datenzugriffe laufen hierüber.
 */
import type {
  AgendaItem,
  AgendaServiceOption,
  AuthStatus,
  Service,
  SetlistSong,
  SongArrangementOption,
  SongLibraryEntry,
  SongSearchResult,
  SongVersion,
  UserCapabilities,
} from '@shared/types/index';
import { apiFetch } from './api';

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
export function getCapabilities(): Promise<UserCapabilities> {
  return apiFetch<UserCapabilities>('/api/capabilities');
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

/** Setzt das Verantwortlich-Textfeld eines Punkts (z.B. „[Musik]"); CT löst Dienste auf. */
export function setAgendaItemResponsible(
  eventId: number,
  itemId: number,
  responsible: string,
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ responsible }),
  });
}

/** Setzt die Dauer eines Punkts (in Minuten); CT berechnet die Uhrzeiten daraus neu. */
export function setAgendaItemDuration(
  eventId: number,
  itemId: number,
  durationMin: number,
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ durationMin }),
  });
}

/** Setzt die Bemerkung/Notiz eines Punkts (leerer String löscht sie). */
export function setAgendaItemNote(
  eventId: number,
  itemId: number,
  note: string,
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ note }),
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

/** Sucht Songs in ChurchTools (für „Lied hinzufügen"). */
export function searchSongs(query: string): Promise<SongSearchResult[]> {
  return apiFetch<SongSearchResult[]>(`/api/songs?query=${encodeURIComponent(query)}`);
}

/** Alle Lieder (für die „Alle Lieder"-Ansicht) – ohne Statistik (lädt schnell). */
export function getSongLibrary(): Promise<SongLibraryEntry[]> {
  return apiFetch<SongLibraryEntry[]>('/api/song-library');
}

/** Nutzungsdaten je Song (Häufigkeit + zuletzt) – separat, gecacht. */
export type SongUsageMap = Record<string, { count: number; lastUsed: string }>;
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

/** Benennt einen Ablaufpunkt um (Titel). */
export function renameAgendaItem(
  eventId: number,
  itemId: number,
  title: string,
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  });
}

/** Verknüpft einen bestehenden Ablaufpunkt mit einem Lied (wandelt ihn in ein Lied um). */
export function linkSongToAgendaItem(
  eventId: number,
  itemId: number,
  arrangementId: number,
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ arrangementId }),
  });
}

/** Hebt die Lied-Verknüpfung eines Punkts auf (Punkt bleibt als Text mit dem Liedtitel). */
export function unlinkSongFromAgendaItem(
  eventId: number,
  itemId: number,
  title: string,
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ unlink: true, title }),
  });
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
