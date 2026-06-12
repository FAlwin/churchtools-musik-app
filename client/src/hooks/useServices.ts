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

/** Lädt alle Ablaufpunkte eines Gottesdienstes (Lieder inkl. ChordPro). */
export function useAgenda(eventId: number | null) {
  return useQuery({
    queryKey: ['agenda', eventId],
    queryFn: () => api.getAgenda(eventId as number),
    enabled: eventId !== null,
    staleTime: 1000 * 60 * 5,
  });
}
