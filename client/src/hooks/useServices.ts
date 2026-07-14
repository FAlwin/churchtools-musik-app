import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/churchtoolsApi';
import { ApiError } from '../services/api';

// Kurze Frische für die aktuellen (aktiven) Daten: So erscheinen ChurchTools-Änderungen
// (verschobene Punkte, geänderte Setlist) zeitnah – die Query gilt schon nach 30 s als veraltet
// und wird beim nächsten App-Fokus / Wiederverbinden neu geladen (#159). Vorher waren es 5 min,
// wodurch Änderungen sehr lange unsichtbar blieben. Die Offline-Reserve hängt an `gcTime`
// (7 Tage, queryClient.ts) und bleibt davon unberührt.
const ACTIVE_STALE_MS = 1000 * 30;

/** Lädt die Gottesdienste mit Setlist (Standardfenster: ~1 Woche zurück bis 6 Wochen voraus). */
export function useServices(enabled: boolean) {
  return useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
    enabled,
    staleTime: ACTIVE_STALE_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Sanftes Polling, solange die Liste sichtbar ist (Hintergrund-Tabs pollen nicht): So
    // erscheint der „Ablauf geändert"-Punkt auch auf einem unberührt daliegenden Gerät von
    // selbst (#143). 60 s = guter Kompromiss; jede Runde kostet ~2 CT-Abrufe je Termin im Fenster.
    refetchInterval: 60_000,
  });
}

/**
 * Merkt den aktuellen Setlist-Stand eines Termins als „gesehen" (#143). MUSS bei JEDEM Öffnen
 * laufen – auch (gerade!) beim ersten Mal, denn erst dieser gemerkte Stand ist die Basislinie,
 * gegen die spätere Änderungen das Badge auslösen. `refresh` steuert nur, ob danach die (teure)
 * Terminliste neu geladen wird: nötig, wenn gerade ein Badge quittiert wurde, damit es
 * verschwindet – beim reinen Basislinie-Setzen unnötig. Fehler werden geschluckt (Komfort-Hinweis).
 */
export function useMarkSetlistSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { eventId: number; refresh: boolean }) => api.markSetlistSeen(v.eventId),
    onSuccess: (_data, v) => {
      if (v.refresh) void qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

/**
 * Live-Abgleich für einen geöffneten Ablauf: pollt alle ~8 s den billigen Ablauf-Fingerabdruck
 * (kein ChordPro-Download; der Server bündelt Abfragen mehrerer Geräte in einem Kurz-Memo).
 * Die Auswertung (Ablauf neu laden / Hinweis im Liederheft) übernimmt App.tsx.
 */
export function useSetlistVersion(eventId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['setlist-version', eventId],
    queryFn: () => api.getSetlistVersion(eventId as number),
    enabled: enabled && eventId !== null,
    refetchInterval: 8_000,
    staleTime: 0,
    // Kein Retry-Getrommel: schlägt ein Poll fehl (Netz-Aussetzer), kommt in 8 s der nächste.
    retry: false,
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
    queryFn: () =>
      api.getServices({
        from: monthsAgoIso(monthsBack),
        to: new Date().toISOString().slice(0, 10),
      }),
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
    // Kurze Frische (#159): verschobene/geänderte Ablaufpunkte erscheinen zeitnah beim
    // nächsten Fokus/Wiederverbinden statt erst nach 5 min.
    staleTime: ACTIVE_STALE_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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
      qc.invalidateQueries({ queryKey: ['song-usage'] });
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
      qc.invalidateQueries({ queryKey: ['song-usage'] });
    },
  });
}

/** Hebt die Lied-Verknüpfung eines Punkts auf und lädt Ablauf + Übersicht neu. */
export function useUnlinkSongFromAgendaItem(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number }) => api.unlinkSongFromAgendaItem(eventId as number, v.itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda', eventId] });
      qc.invalidateQueries({ queryKey: ['services'] });
      qc.invalidateQueries({ queryKey: ['song-usage'] });
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

/** Setzt die Dauer eines Punkts (Minuten) und lädt den Ablauf neu (Uhrzeiten ändern sich). */
export function useSetAgendaItemDuration(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number; durationMin: number }) =>
      api.setAgendaItemDuration(eventId as number, v.itemId, v.durationMin),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda', eventId] }),
  });
}

/** Blendet die Uhrzeit eines Punkts in ChurchTools aus/ein (Auge) und lädt den Ablauf neu. */
export function useSetAgendaItemHidden(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number; hidden: boolean }) =>
      api.setAgendaItemHidden(eventId as number, v.itemId, v.hidden),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda', eventId] }),
  });
}

/** Setzt die Bemerkung/Notiz eines Punkts und lädt den Ablauf neu. */
export function useSetAgendaItemNote(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number; note: string }) =>
      api.setAgendaItemNote(eventId as number, v.itemId, v.note),
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

/** Lädt die Rechte des angemeldeten Nutzers. Dieser Aufruf ist das „Tor" zur App – schlägt er
 *  wegen eines ChurchTools-Aussetzers (z. B. leere Rechte-Antwort → 502) fehl, versuchen wir es
 *  mehrfach automatisch mit wachsender Pause, statt gleich das „keine Berechtigung"-Schloss bzw.
 *  den Fehlerschirm zu zeigen. */
export function useCapabilities(enabled: boolean) {
  return useQuery({
    queryKey: ['capabilities'],
    queryFn: () => api.getCapabilities(),
    enabled,
    // Persistierter Stand wird sofort angezeigt (kein Flackern), aber bei jedem App-Start neu
    // geholt: So greifen vom Admin geänderte Rechte (z. B. Team-Notizen freigeben) schon beim
    // nächsten Neuladen – ohne Ab-/Neuanmelden. Kurzer staleTime bremst Navigations-Refetches.
    staleTime: 1000 * 60,
    refetchOnMount: 'always',
    // Eine abgelaufene/ungültige ChurchTools-Sitzung (401) lässt sich nicht „wegwiederholen" –
    // sofort aufgeben (App.tsx führt dann zum Login). Nur echte Aussetzer (502) 3× erneut versuchen.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 401 ? false : failureCount < 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
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

/** Lädt die Arrangements eines bekannten Lieds (für „Zu Ablauf hinzufügen"). */
export function useSongArrangements(songId: number | null) {
  return useQuery({
    queryKey: ['song-arrangements', songId],
    queryFn: () => api.getSongArrangements(songId as number),
    enabled: songId !== null,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fügt ein Lied (per Arrangement) ans Ende des Ablaufs eines beliebigen Termins.
 * Im Gegensatz zu useCreateAgendaItem ist der Termin nicht fest, sondern wird pro Aufruf übergeben.
 */
export function useAddSongToService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { eventId: number; arrangementId: number; title: string }) =>
      api.createAgendaItem(v.eventId, {
        type: 'song',
        title: v.title,
        arrangementId: v.arrangementId,
      }),
    onSuccess: (_data, v) => {
      qc.invalidateQueries({ queryKey: ['agenda', v.eventId] });
      qc.invalidateQueries({ queryKey: ['services'] });
      qc.invalidateQueries({ queryKey: ['song-usage'] });
    },
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
      note?: string;
      durationMin?: number;
    }) => api.createAgendaItem(eventId as number, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda', eventId] });
      qc.invalidateQueries({ queryKey: ['services'] });
      qc.invalidateQueries({ queryKey: ['song-usage'] });
    },
  });
}
