import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NeueAbsence } from '@shared/types/index';
import * as api from '../services/availability';

/** Ein Schlüssel-Stamm für alles, was nach einem Schreibvorgang neu geholt werden muss. */
export const ABSENCES_KEY = ['absences'] as const;

export function useMyAbsences(enabled: boolean) {
  return useQuery({
    queryKey: [...ABSENCES_KEY, 'mine'],
    queryFn: () => api.getMyAbsences(),
    enabled,
    staleTime: 30_000,
  });
}

export function useAbsenceEvents(enabled: boolean, weeks = 10) {
  return useQuery({
    queryKey: [...ABSENCES_KEY, 'events', weeks],
    queryFn: () => api.getAbsenceEvents(weeks),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Nach Anlegen/Löschen die eigene Liste neu holen – die Termine ändern sich dadurch nicht. */
function useAbsencesRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [...ABSENCES_KEY, 'mine'] });
}

export function useCreateAbsence() {
  const refresh = useAbsencesRefresh();
  return useMutation({
    mutationFn: (neu: NeueAbsence) => api.createAbsence(neu),
    onSuccess: () => void refresh(),
  });
}

export function useDeleteAbsence() {
  const refresh = useAbsencesRefresh();
  return useMutation({
    mutationFn: (id: number) => api.deleteAbsence(id),
    onSuccess: () => void refresh(),
  });
}
