/**
 * Konkrete Backend-Endpunkte der Worship-App. Alle UI-Datenzugriffe laufen hierüber.
 */
import type { AuthStatus, Service, SetlistSong } from '@shared/types/index';
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

export function getServices(): Promise<Service[]> {
  return apiFetch<Service[]>('/api/services');
}

export function getSetlist(eventId: number): Promise<SetlistSong[]> {
  return apiFetch<SetlistSong[]>(`/api/services/${eventId}/setlist`);
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
