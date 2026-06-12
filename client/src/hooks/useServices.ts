import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

/** Speichert eine neue Ablauf-Reihenfolge und lädt den Ablauf danach neu. */
export function useReorderAgenda(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: number[]) => api.reorderAgenda(eventId as number, order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda', eventId] }),
  });
}

/** Löscht einen Ablaufpunkt und lädt den Ablauf danach neu. */
export function useDeleteAgendaItem(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => api.deleteAgendaItem(eventId as number, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda', eventId] }),
  });
}
