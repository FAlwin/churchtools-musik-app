/**
 * Konkrete Backend-Endpunkte der Worship-App. Alle UI-Datenzugriffe laufen hierüber.
 */
import type { AgendaItem, AuthStatus, Service } from '@shared/types/index';
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
