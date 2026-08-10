import { useEffect } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { SetlistSong } from '@shared/types/index';
import * as api from '../services/churchtoolsApi';
import type { SongSettings } from '../utils/chartSettings';

/**
 * Ein selbst gewähltes Arrangement in die Liederliste einsetzen (#320).
 *
 * **Warum es diesen Hook überhaupt gibt:** Der Wechsel gilt nur für mich – in ChurchTools wird
 * nichts geändert. Damit kann der Server den Ablauf nicht mit dem anderen Arrangement liefern; der
 * Client muss dessen Chart-Daten selbst holen und den Eintrag ersetzen. Hätte der Wechsel
 * zurückgeschrieben, wäre es ein Neuladen des Ablaufs gewesen.
 *
 * **`useQueries` und keine Schleife über `useSongChart`:** Welche Lieder überschrieben sind, steht
 * erst zur Laufzeit fest – Hooks lassen sich nicht in einer Schleife über eine wechselnde Liste
 * aufrufen. `useQueries` ist genau dafür da.
 *
 * **Während des Ladens gilt der Eintrag aus dem Ablauf.** Nicht „nichts": Sonst verschwänden die
 * Seiten für einen Moment, und im Gottesdienst ist ein leeres Blatt das Letzte, was man braucht.
 * Dasselbe bei einem Fehlschlag – dann bleibt es beim Ablauf, statt das Lied auszulassen.
 */

/**
 * Der Abfrage-Schlüssel eines Arrangements – an EINER Stelle, damit Abruf und Vorladen sich den
 * Zwischenspeicher wirklich teilen. Mit zwei Schreibweisen läge dasselbe Blatt zweimal darin, und
 * das Vorladen wäre wirkungslos, ohne dass es auffiele.
 */
export function chartQueryKey(songId: number, arrangementId: number) {
  return ['song-chart', songId, arrangementId] as const;
}

/**
 * Die Chart-Daten anderer Arrangements im Voraus holen (#320).
 *
 * **Warum überhaupt:** Gemessen dauert der Wechsel gegen den Test-Server 52 ms – gegen echtes
 * ChurchTools deutlich länger, weil der Server dort das Lied abruft UND die ChordPro-Datei
 * herunterlädt. Von Alwin als „dauert super lange" gemeldet. Steht das Blatt schon im
 * Zwischenspeicher, ist der Wechsel sofort da.
 *
 * **Erst beim Öffnen des Menüs**, nicht schon beim Öffnen des Lieds: Dort ist die Absicht sichtbar.
 * Und nur die Arrangements des AKTIVEN Lieds – bei acht Liedern im Ablauf wären es sonst Dutzende
 * Abrufe gegen ChurchTools. Genau daran ist die App schon einmal in ein Rate-Limit gelaufen (#300).
 */
export function useArrangementVorladen(
  songId: number,
  arrangementIds: number[],
  aktiv: boolean,
): void {
  const qc = useQueryClient();
  const schluessel = arrangementIds.join(',');
  useEffect(() => {
    if (!aktiv) return;
    for (const id of arrangementIds) {
      void qc.prefetchQuery({
        queryKey: chartQueryKey(songId, id),
        queryFn: () => api.getSongChart(songId, id),
        staleTime: 1000 * 60 * 5,
      });
    }
    // `schluessel` statt des Arrays: Ein neues Array mit denselben Zahlen darf nicht erneut laden.
  }, [aktiv, songId, schluessel, qc]);
}

export function useArrangementUeberschreibung(
  songs: SetlistSong[],
  settings: Record<number, SongSettings>,
): { songs: SetlistSong[]; laedt: boolean } {
  /** Welches Arrangement ist gewählt, und weicht es überhaupt ab? */
  const gewaehlt = (s: SetlistSong): number | null => {
    const id = settings[s.id]?.arrangementId ?? null;
    return id !== null && id !== s.arrangementId ? id : null;
  };

  const offen = songs.filter((s) => gewaehlt(s) !== null);

  const ergebnisse = useQueries({
    queries: offen.map((s) => {
      const arrangementId = gewaehlt(s) as number;
      return {
        // Derselbe Schlüssel wie beim Vorladen und in `useSongChart` – so teilen sich alle den
        // Zwischenspeicher, statt dasselbe Arrangement mehrfach zu holen.
        queryKey: chartQueryKey(s.id, arrangementId),
        queryFn: () => api.getSongChart(s.id, arrangementId),
        staleTime: 1000 * 60 * 5,
      };
    }),
  });

  const ersatz = new Map<number, SetlistSong>();
  offen.forEach((s, i) => {
    const daten = ergebnisse[i]?.data;
    if (daten) ersatz.set(s.id, daten);
  });

  // „Es fehlt noch etwas" – daraus macht die Anzeige eine Rückmeldung. Ohne sie sieht ein Wechsel
  // aus wie ein Aussetzer: Das alte Blatt bleibt absichtlich stehen, und nichts sagt, dass gearbeitet
  // wird.
  const laedt = offen.length > ersatz.size;

  if (ersatz.size === 0) return { songs, laedt };
  return { songs: songs.map((s) => ersatz.get(s.id) ?? s), laedt };
}
