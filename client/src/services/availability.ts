/**
 * Verfügbarkeit (#177): eigene Abwesenheiten über den eigenen Server – der spricht mit ChurchTools
 * im Namen des angemeldeten Kontos. Kein Excel hier; der Sync ist ein eigener Dienst.
 */
import type { Absence, AbsenceEvent, NeueAbsence } from '@shared/types/index';
import { apiFetch } from './api';

export function getMyAbsences(): Promise<Absence[]> {
  return apiFetch<Absence[]>('/api/absences');
}

export function getAbsenceEvents(weeks = 10): Promise<AbsenceEvent[]> {
  return apiFetch<AbsenceEvent[]>(`/api/absences/events?weeks=${weeks}`);
}

export function createAbsence(neu: NeueAbsence): Promise<Absence> {
  return apiFetch<Absence>('/api/absences', { method: 'POST', body: JSON.stringify(neu) });
}

export function deleteAbsence(id: number): Promise<void> {
  return apiFetch<void>(`/api/absences/${id}`, { method: 'DELETE' });
}
