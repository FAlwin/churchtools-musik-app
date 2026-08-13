import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  LiedAnlegenAuftrag,
  LiedStammdaten,
  SongSelectSuchergebnis,
} from '@shared/types/index';
import { sucheArt } from '../utils/liedFormular';
import * as api from '../services/churchtoolsApi';
import { ApiError } from '../services/api';

// Kurze Frische für die aktuellen (aktiven) Daten: So erscheinen ChurchTools-Änderungen
// (verschobene Punkte, geänderte Setlist) zeitnah – die Query gilt schon nach 30 s als veraltet
// und wird beim nächsten App-Fokus / Wiederverbinden neu geladen (#159). Vorher waren es 5 min,
// wodurch Änderungen sehr lange unsichtbar blieben. Die Offline-Reserve hängt an `gcTime`
// (7 Tage, queryClient.ts) und bleibt davon unberührt.
const ACTIVE_STALE_MS = 1000 * 30;

/** Lädt die Gottesdienste mit Setlist (Standardfenster: ~1 Woche zurück bis 6 Wochen voraus). */
export function useServices(enabled: boolean, poll = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
    enabled,
    staleTime: ACTIVE_STALE_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    /**
     * Sanftes Polling, damit der „Ablauf geändert"-Punkt auch auf einem unberührt daliegenden Gerät
     * von selbst erscheint (#143).
     *
     * **`poll` steuert es seit #306.** Der frühere Kommentar behauptete „solange die Liste sichtbar
     * ist" – das stimmte nicht: Pausiert wurde nur, wenn der ganze Browser-Tab in den Hintergrund
     * ging. Im Liederheft lief der 60-Sekunden-Takt weiter, obwohl die Terminliste gar nicht zu sehen
     * war. Und **jede Runde kostet rund `1 + 2 × Termine` ChurchTools-Anfragen** (~17 im
     * Standardfenster) – bei fünf Geräten im Gottesdienst die größte Dauerlast der App.
     *
     * Die Abfrage bleibt aktiviert (`enabled`), nur der Takt entfällt: `useAppNav` und die
     * Offline-Vorbereitung brauchen die Daten weiterhin.
     */
    refetchInterval: poll ? 60_000 : false,
  });

  /**
   * Wird der Takt wieder eingeschaltet, EINMAL sofort nachladen – und zwar hier, direkt neben dem
   * Takt selbst.
   *
   * Ohne das wäre #306 ein Rückschritt: React Query startet beim Wiedereinschalten nur den Timer neu
   * und holt **nicht** von sich aus. Nach zehn Minuten im Liederheft sähe man also eine zehn Minuten
   * alte Terminliste, und das noch bis zu 60 Sekunden lang. Vorher lief der Takt durch – die Liste war
   * nie älter als eine Minute. (Empirisch nachgestellt: verborgen → zurück ergab 0 zusätzliche
   * Aufrufe.)
   *
   * Die Zeile steht bewusst im Hook und nicht beim Aufrufer: „Takt pausiert" und „beim Zurückkommen
   * frisch" sind zwei Hälften EINER Regel. Getrennt abgelegt, vergisst sie der nächste Aufrufer.
   *
   * ⚠️ Bewusst über den QueryClient statt über `query.refetch`: React Query merkt sich, welche Felder
   * des Ergebnisses während des Renderns gelesen werden, und benachrichtigt danach NUR noch bei deren
   * Änderung. Würde hier `refetch` herausgezogen, gälte allein `refetch` als beobachtet – neue Daten
   * lösten dann in Komponenten, die sonst nichts lesen, kein Rendern mehr aus. Ein Test hat genau das
   * gezeigt (Abfrage blieb ewig `pending`).
   */
  const taktLiefVorher = useRef(poll);
  useEffect(() => {
    if (poll && !taktLiefVorher.current && enabled) {
      void qc.refetchQueries({ queryKey: ['services'], exact: true });
    }
    taktLiefVorher.current = poll;
  }, [poll, enabled, qc]);

  return query;
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
      void qc.invalidateQueries({ queryKey: ['agenda', eventId] });
      void qc.invalidateQueries({ queryKey: ['services'] });
      void qc.invalidateQueries({ queryKey: ['song-usage'] });
    },
  });
}

/**
 * Schreibt geänderte Felder eines Ablaufpunkts gesammelt (EIN PUT) und lädt den Ablauf EINMAL
 * neu – statt Request + Refetch pro Feld. Ändert sich die Lied-Verknüpfung, werden zusätzlich
 * Terminliste (Lied-Anzahl) und Statistik aktualisiert.
 */
export function useUpdateAgendaItem(eventId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: number; fields: api.AgendaItemUpdate }) =>
      api.updateAgendaItem(eventId as number, v.itemId, v.fields),
    onSuccess: (_data, v) => {
      void qc.invalidateQueries({ queryKey: ['agenda', eventId] });
      if (v.fields.arrangementId !== undefined || v.fields.unlink) {
        void qc.invalidateQueries({ queryKey: ['services'] });
        void qc.invalidateQueries({ queryKey: ['song-usage'] });
      }
    },
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

/**
 * Lädt die Lied-Kategorien, in denen der Nutzer anlegen/ändern darf (#322).
 *
 * **Kurze Vorhaltezeit (5 min) mit Absicht.** Kategorien ändern sich fast nie, aber die Liste hängt an
 * einem **Recht** – wird es in ChurchTools entzogen, soll die Auswahl nicht stundenlang eine Kategorie
 * anbieten, die es für diesen Nutzer nicht mehr gibt. Die Liedliste darf 10 Minuten alt sein, eine
 * Berechtigung eher nicht.
 */
export function useSongCategories(enabled: boolean) {
  return useQuery({
    queryKey: ['song-categories'],
    queryFn: () => api.getSongCategories(),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

/** Ab wie vielen Zeichen bei CCLI gesucht wird – kürzere Eingaben ergeben nur Rauschen. */
export const SONGSELECT_MIN_ZEICHEN = 3;

/**
 * Sucht bei CCLI SongSelect nach einem Titel (#322).
 *
 * **Jede Suche geht über ChurchTools an CCLI** – deshalb wird sie nicht bei jedem Tastendruck
 * ausgelöst: Der Aufrufer gibt den Suchbegriff entprellt herein, und unter drei Zeichen läuft gar
 * nichts. **Kein automatischer zweiter Versuch:** Ein Fehler von CCLI (keine Lizenz, Aussetzer)
 * wiederholt sich meist, und die Meldung ist hier die nützlichere Antwort als ein stiller Retry.
 */
export function useSongSelectSuche(eingabe: string, enabled: boolean) {
  const begriff = eingabe.trim();
  const art = sucheArt(begriff);
  return useQuery({
    // Die Art gehört in den Schlüssel: „5841527" und ein gleichnamiger Titel sind zwei Abfragen.
    queryKey: ['songselect-search', art.art, begriff],
    queryFn: async (): Promise<SongSelectSuchergebnis> => {
      if (art.art === 'titel') return api.sucheSongSelect(art.titel);
      /**
       * **Eine CCLI-Nummer ist keine Suche, sondern eine Abfrage** – sie liefert genau ein Lied.
       * Das Ergebnis wird in dieselbe Form gebracht, damit die Trefferliste nicht zwei Fälle kennen
       * muss: ein Treffer, vollständig.
       */
      const lied = await api.getSongSelectSong(art.nummer);
      return { treffer: [lied], gesamt: 1, vollstaendig: true };
    },
    enabled: enabled && begriff.length >= SONGSELECT_MIN_ZEICHEN,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

/**
 * Lädt die Stammdaten eines Liedes für das Änderungsformular (#322, Schritt 11).
 *
 * **`staleTime: 0` mit Absicht.** Diese Abfrage füllt ein Formular, aus dem heraus geschrieben wird –
 * ein alter Stand wäre hier gefährlicher als eine zusätzliche Anfrage. Der Server liest beim Speichern
 * ohnehin noch einmal frisch (`liedAendern`), aber der Nutzer soll auch SEHEN, was gerade gilt.
 */
export function useSongStammdaten(songId: number | null) {
  return useQuery({
    queryKey: ['song-stammdaten', songId],
    queryFn: () => api.getSongStammdaten(songId as number),
    enabled: songId !== null,
    staleTime: 0,
  });
}

/**
 * Ändert die Stammdaten eines Liedes (#322, Schritt 11).
 *
 * Danach ist **alles ungültig, wo ein Liedname steht**: Bibliothek, Chart und – falls das Lied im
 * Ablauf vorkommt – die Abläufe. Bewusst NICHT die Statistik (`song-usage`): Ein umbenanntes Lied wurde
 * nicht öfter oder seltener gespielt, und der Lauf kostet ~250 ChurchTools-Anfragen (#300).
 */
export function useLiedAendern(songId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aenderung: Partial<LiedStammdaten>) => api.aendereLied(songId, aenderung),
    onSuccess: (stand) => {
      // Den frischen Stand direkt in den Cache legen, damit das Formular nicht kurz den alten zeigt.
      qc.setQueryData(['song-stammdaten', songId], stand);
      void qc.invalidateQueries({ queryKey: ['song-library'] });
      void qc.invalidateQueries({ queryKey: ['song-chart', songId] });
      void qc.invalidateQueries({ queryKey: ['agenda'] });
    },
  });
}

/**
 * Löscht ein Lied (#322, Schritt 11).
 *
 * Räumt danach auch die **Anmerkungs-Abfragen** nicht weg – die liegen pro Konto und verweisen auf eine
 * songId, die es nicht mehr gibt; sie laufen ins Leere, richten aber keinen Schaden an. Was hier zählt:
 * Bibliothek und Abläufe müssen neu geladen werden, sonst zeigt die App ein Lied, das nicht mehr da ist.
 */
export function useLiedLoeschen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (songId: number) => api.loescheLied(songId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['song-library'] });
      void qc.invalidateQueries({ queryKey: ['agenda'] });
      void qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

/**
 * Legt ein Lied an (#322) – Lied + erstes Arrangement, auf Wunsch mit Ablauf-Eintrag.
 *
 * **Die Liedliste wird danach ungültig, die Statistik nur bei einem Ablauf-Eintrag.** Ohne Termin hat
 * sich an der Nutzung nichts geändert; sie neu zu holen wären ChurchTools-Anfragen für nichts (#300).
 *
 * Was **nicht** hier steht: ein Wiederholversuch. Ein zweiter Durchlauf legte ein zweites Lied an
 * (siehe `songErstellen.ts`) – React Query wiederholt Mutationen von sich aus nicht, und das bleibt so.
 */
export function useLiedAnlegen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (auftrag: LiedAnlegenAuftrag) => api.legeLiedAn(auftrag),
    onSuccess: (ergebnis, auftrag) => {
      void qc.invalidateQueries({ queryKey: ['song-library'] });
      if (auftrag.eventId !== undefined && ergebnis.imAblauf) {
        void qc.invalidateQueries({ queryKey: ['agenda', auftrag.eventId] });
        void qc.invalidateQueries({ queryKey: ['services'] });
        void qc.invalidateQueries({ queryKey: ['song-usage'] });
      }
    },
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
      void qc.invalidateQueries({ queryKey: ['agenda', v.eventId] });
      void qc.invalidateQueries({ queryKey: ['services'] });
      void qc.invalidateQueries({ queryKey: ['song-usage'] });
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
      void qc.invalidateQueries({ queryKey: ['agenda', eventId] });
      void qc.invalidateQueries({ queryKey: ['services'] });
      void qc.invalidateQueries({ queryKey: ['song-usage'] });
    },
  });
}
