import { useQuery } from '@tanstack/react-query';
import * as api from '../services/churchtoolsApi';

/** Lädt die Gottesdienste mit Setlist. */
export function useServices(enabled: boolean) {
  return useQuery({
    queryKey: ['services'],
    queryFn: api.getServices,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

/** Lädt die Songs einer Setlist (inkl. ChordPro). */
export function useSetlist(eventId: number | null) {
  return useQuery({
    queryKey: ['setlist', eventId],
    queryFn: () => api.getSetlist(eventId as number),
    enabled: eventId !== null,
    staleTime: 1000 * 60 * 5,
  });
}
