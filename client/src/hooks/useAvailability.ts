import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NeueAbsence } from '@shared/types/index';
import * as api from '../services/availability';

/** Ein Schlüssel-Stamm für alles, was nach einem Schreibvorgang neu geholt werden muss. */
export const ABSENCES_KEY = ['absences'] as const;

/**
 * Eigene Abwesenheiten in einem Fenster. Die Seite „Einträge" zeigt auch **Vergangenes** („Früher",
 * Wunsch Alwin 19.09.2026) – deshalb reicht das Fenster ein Jahr zurück, nicht nur voraus.
 */
export function useMyAbsences(enabled: boolean, from?: string, to?: string) {
  return useQuery({
    queryKey: [...ABSENCES_KEY, 'mine', from ?? '', to ?? ''],
    queryFn: () => api.getMyAbsences(from, to),
    enabled,
    staleTime: 30_000,
  });
}

/** Kommende Termine bis `bis` – so weit, wie das Monatsraster reicht. */
export function useAbsenceEvents(enabled: boolean, bis?: string) {
  return useQuery({
    queryKey: [...ABSENCES_KEY, 'events', bis ?? ''],
    queryFn: () => api.getAbsenceEvents(bis),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Nach Anlegen/Löschen die eigene Liste neu holen – die Termine ändern sich dadurch nicht. */
function useAbsencesRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [...ABSENCES_KEY, 'mine'] });
}

/** Die Gründe der Gemeinde – ändern sich fast nie, deshalb lange frisch. */
export function useAbsenceReasons(enabled: boolean) {
  return useQuery({
    queryKey: [...ABSENCES_KEY, 'reasons'],
    queryFn: () => api.getAbsenceReasons(),
    enabled,
    staleTime: 30 * 60_000,
  });
}

export function useCreateAbsence() {
  const refresh = useAbsencesRefresh();
  return useMutation({
    mutationFn: (neu: NeueAbsence) => api.createAbsence(neu),
    onSuccess: () => void refresh(),
  });
}

export function useUpdateAbsence() {
  const refresh = useAbsencesRefresh();
  return useMutation({
    mutationFn: ({ id, neu }: { id: number; neu: NeueAbsence }) => api.updateAbsence(id, neu),
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

/** Was die Terminliste beim Speichern gesammelt schreibt: neue Eintages-Abwesenheiten und zu löschende Einträge. */
export interface AbsenceAenderungen {
  /** Tage (`YYYY-MM-DD`), an denen ein neuer Haken sitzt – je Tag eine Abwesenheit mit Standardgrund. */
  eintragen: string[];
  /** IDs, deren Haken entfernt wurde – Eintages-Einträge und ganze Zeiträume gleichermaßen. */
  loeschen: number[];
}

/**
 * **Alle Häkchen auf einmal** (Entscheidung Alwin + Frau, 19.09.2026: kein Bearbeiten-Modus, aber
 * nichts ohne „Speichern" – wie im alten Abwesenheitsplaner).
 *
 * Die Aufrufe laufen **nacheinander**, nicht parallel: ChurchTools drosselt (429, #383), und ein
 * Musiker hakt selten mehr als drei Termine auf einmal ab. Erst anlegen, dann löschen – so ist nach
 * einem Fehlschlag in der Mitte höchstens ein Haken zu viel gesetzt, nie einer zu wenig. Der Rest wird
 * danach in jedem Fall neu geholt, damit die Liste den wahren Stand zeigt.
 */
export function useSaveAbsenceChanges() {
  const refresh = useAbsencesRefresh();
  return useMutation({
    mutationFn: async ({ eintragen, loeschen }: AbsenceAenderungen) => {
      for (const tag of eintragen) await api.createAbsence({ startDate: tag, endDate: tag });
      for (const id of loeschen) await api.deleteAbsence(id);
      return eintragen.length + loeschen.length;
    },
    onSettled: () => void refresh(),
  });
}
