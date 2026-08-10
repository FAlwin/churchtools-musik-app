import { useQueries } from '@tanstack/react-query';
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
export function useArrangementUeberschreibung(
  songs: SetlistSong[],
  settings: Record<number, SongSettings>,
): SetlistSong[] {
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
        // Derselbe Schlüssel wie in `useSongChart` – so teilen sich beide den Zwischenspeicher,
        // statt dasselbe Arrangement zweimal zu holen.
        queryKey: ['song-chart', s.id, arrangementId],
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

  if (ersatz.size === 0) return songs;
  return songs.map((s) => ersatz.get(s.id) ?? s);
}
