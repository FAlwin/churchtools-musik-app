import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMarkSetlistSeen, useSetlistVersion } from './useServices';

/**
 * Live-Abgleich des geöffneten Ablaufs (#159/#161): Solange Ablauf oder Liederheft (aus dem
 * Ablauf) offen sind, wird alle ~8 s der billige Fingerabdruck gepollt. Ändert er sich:
 * Die Ablauf-Ansicht lädt sofort nach (dort stört das nie); im Liederheft wird stattdessen
 * `chartOutdated` gesetzt (Hinweis-Balken) – NIE automatisch umsortieren, sonst springen mitten
 * im Spielen die Seiten unter den Fingern.
 *
 * Die Effekte sind über `lastLiveHash` idempotent (gleicher Hash → nichts zu tun), daher kommen
 * sie ohne reduzierte Dependency-Arrays aus.
 */
export function useSetlistLiveSync(args: {
  eventId: number | null;
  inSetlistView: boolean;
  inSetlistChart: boolean;
  online: boolean;
}): {
  chartOutdated: boolean;
  reloadAblauf: (eventId: number) => void;
  dismissChartOutdated: () => void;
} {
  const { eventId, inSetlistView, inSetlistChart, online } = args;
  const qc = useQueryClient();
  const liveVersion = useSetlistVersion(eventId, online && (inSetlistView || inSetlistChart));
  const [chartOutdated, setChartOutdated] = useState(false);
  const lastLiveHash = useRef<{ eventId: number; hash: string } | null>(null);

  // Ablauf neu laden (Live-Update): Der Server markiert die geänderten Punkte anhand des zuletzt
  // GESEHENEN Stands – dieser wird bewusst NICHT hier aktualisiert, sondern erst beim Verlassen
  // des Termins (useMarkSeenOnLeave). So leuchten auch live eingetroffene Änderungen auf.
  const reloadAblauf = useCallback(
    (id: number) => {
      void qc.invalidateQueries({ queryKey: ['agenda', id] });
      setChartOutdated(false);
    },
    [qc],
  );

  useEffect(() => {
    const hash = liveVersion.data?.hash;
    if (hash === undefined || eventId == null) return;
    const prev = lastLiveHash.current;
    lastLiveHash.current = { eventId, hash };
    // Erster Poll für diesen Termin = Referenz, noch keine Änderung.
    if (!prev || prev.eventId !== eventId || prev.hash === hash) return;
    if (inSetlistView) reloadAblauf(eventId);
    else if (inSetlistChart) setChartOutdated(true);
  }, [liveVersion.data?.hash, eventId, inSetlistView, inSetlistChart, reloadAblauf]);

  useEffect(() => {
    // Vom Liederheft mit offenem „geändert"-Hinweis zurück in den Ablauf → dort direkt neu laden.
    if (chartOutdated && inSetlistView && eventId != null) reloadAblauf(eventId);
    // Termin komplett verlassen → Hinweis und Referenz zurücksetzen.
    if (!inSetlistView && !inSetlistChart) {
      setChartOutdated(false);
      lastLiveHash.current = null;
    }
  }, [chartOutdated, inSetlistView, inSetlistChart, eventId, reloadAblauf]);

  const dismissChartOutdated = useCallback(() => setChartOutdated(false), []);
  return { chartOutdated, reloadAblauf, dismissChartOutdated };
}

/**
 * „Gesehen" gilt beim VERLASSEN eines Termins (#143/#161): Erst dann wird der aktuelle Stand als
 * Basislinie gemerkt – so bleiben die aufleuchtenden Markierungen sichtbar, solange man drin ist,
 * und der „geändert"-Punkt in der Terminliste verschwindet nach dem Reinschauen. Ein Wechsel
 * zwischen Ablauf und Liederheft desselben Termins zählt NICHT als Verlassen – der Aufrufer gibt
 * dafür durchgehend dieselbe `openTerminId`.
 */
export function useMarkSeenOnLeave(openTerminId: number | null): void {
  const markSeen = useMarkSetlistSeen();
  const prevRef = useRef<number | null>(null);
  const { mutate } = markSeen;
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = openTerminId;
    if (prev != null && prev !== openTerminId) {
      mutate({ eventId: prev, refresh: true });
    }
  }, [openTerminId, mutate]);
}
