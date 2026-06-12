/**
 * Konkrete Backend-Endpunkte der Worship-App. Alle UI-Datenzugriffe laufen hierüber.
 */
import type {
  AgendaItem,
  AuthStatus,
  Service,
  SetlistSong,
  SongLibraryEntry,
  SongSearchResult,
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
  data: { type: 'header' | 'text' | 'song'; title?: string; arrangementId?: number },
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/items`, {
    method: 'POST',
    body: JSON.stringify(data),
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

/** Löscht einen Ablaufpunkt. */
export function deleteAgendaItem(eventId: number, itemId: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/services/${eventId}/agenda/items/${itemId}`, { method: 'DELETE' });
}

/** Speichert die bearbeitete ECG-Version eines Songs in ChurchTools. */
export function saveChordpro(songId: number, arrangementId: number, text: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/songs/${songId}/chordpro`, {
    method: 'PUT',
    body: JSON.stringify({ arrangementId, text }),
  });
}

/** Löscht die ECG-Version (zurück zum Original). */
export function deleteChordpro(songId: number, arrangementId: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/songs/${songId}/chordpro`, {
    method: 'DELETE',
    body: JSON.stringify({ arrangementId }),
  });
}
