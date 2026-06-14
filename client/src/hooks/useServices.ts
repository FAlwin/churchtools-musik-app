import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/churchtoolsApi';

/** Lädt die Gottesdienste mit Setlist (Standardfenster: ~1 Woche zurück bis 6 Wochen voraus). */
export function useServices(enabled: boolean) {
  return useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

/** Datum vor `monthsBack` Monaten als ISO-Datum (YYYY-MM-DD). */
function monthsAgoIso(monthsBack: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

/** Lädt vergangene Gottesdienste der letzten `monthsBack` Monate (lazy, nur wenn enabled). */
export function usePastServices(monthsBack: number, enabled: boolean) {
  return useQuery({
    queryKey: ['services', 'past', monthsBack],
    queryFn: () => api.getServices({ from: monthsAgoIso(monthsBack), to: new Date().toISOString().slice(0, 10) }),
    enabled,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev, // beim „Mehr laden" alte Liste behalten (kein Flackern)
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

/** Löscht einen Ablaufpunkt und lädt Ablauf + Übersicht (Song-Anzahl) neu. */
export function useDeleteAgendaItem(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => api.deleteAgendaItem(eventId as number, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda', eventId] });
      qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

/** Benennt einen Ablaufpunkt um und lädt den Ablauf danach neu. */
export function useRenameAgendaItem(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number; title: string }) =>
      api.renameAgendaItem(eventId as number, v.itemId, v.title),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda', eventId] }),
  });
}

/** Verknüpft einen bestehenden Ablaufpunkt mit einem Lied und lädt Ablauf + Übersicht neu. */
export function useLinkSongToAgendaItem(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number; arrangementId: number }) =>
      api.linkSongToAgendaItem(eventId as number, v.itemId, v.arrangementId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda', eventId] });
      qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

/** Hebt die Lied-Verknüpfung eines Punkts auf und lädt Ablauf + Übersicht neu. */
export function useUnlinkSongFromAgendaItem(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number; title: string }) =>
      api.unlinkSongFromAgendaItem(eventId as number, v.itemId, v.title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda', eventId] });
      qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

/** Setzt das Verantwortlich-Textfeld eines Punkts und lädt den Ablauf neu. */
export function useSetAgendaItemResponsible(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number; responsible: string }) =>
      api.setAgendaItemResponsible(eventId as number, v.itemId, v.responsible),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda', eventId] }),
  });
}

/** Lädt die ChurchTools-Dienste (für die Verantwortlich-Chips). */
export function useAgendaServices(enabled: boolean) {
  return useQuery({
    queryKey: ['agenda-services'],
    queryFn: () => api.getAgendaServices(),
    enabled,
    staleTime: 1000 * 60 * 30,
  });
}

/** Lädt die Rechte des angemeldeten Nutzers. */
export function useCapabilities(enabled: boolean) {
  return useQuery({
    queryKey: ['capabilities'],
    queryFn: () => api.getCapabilities(),
    enabled,
    staleTime: 1000 * 60 * 30,
  });
}

/** Lädt alle Lieder (für die „Alle Lieder"-Ansicht). */
export function useSongLibrary(enabled: boolean) {
  return useQuery({
    queryKey: ['song-library'],
    queryFn: () => api.getSongLibrary(),
    enabled,
    staleTime: 1000 * 60 * 10,
  });
}

/** Lädt die Song-Nutzungsdaten (Häufigkeit/zuletzt) im Hintergrund. */
export function useSongUsage(enabled: boolean) {
  return useQuery({
    queryKey: ['song-usage'],
    queryFn: () => api.getSongUsage(),
    enabled,
    staleTime: 1000 * 60 * 30,
  });
}

/** Lädt die Chart-Daten eines einzelnen Lieds. */
export function useSongChart(sel: { songId: number; arrangementId?: number } | null) {
  return useQuery({
    queryKey: ['song-chart', sel?.songId, sel?.arrangementId],
    queryFn: () => api.getSongChart(sel!.songId, sel?.arrangementId),
    enabled: sel !== null,
    staleTime: 1000 * 60 * 5,
  });
}

/** Legt einen neuen Ablaufpunkt an und lädt Ablauf + Übersicht (Song-Anzahl) neu. */
export function useCreateAgendaItem(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      type: 'header' | 'text' | 'song';
      title?: string;
      arrangementId?: number;
      responsible?: string;
    }) => api.createAgendaItem(eventId as number, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda', eventId] });
      qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}
