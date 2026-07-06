import { useEffect, useRef } from 'react';
import type { Service } from '@shared/types/index';
import { queryClient } from '../queryClient';
import * as api from '../services/churchtoolsApi';
import { getOfflineRegistry, saveServiceOffline } from '../services/offline';
import { isOfflineAutoEnabled } from '../services/offlineAuto';

/**
 * Hält Gottesdienste automatisch offline bereit (#32): den NÄCHSTEN kommenden immer (sofern der
 * Schalter an ist) und zusätzlich alle, die der Nutzer per Termin-Knopf ins Offline-Verzeichnis
 * gelegt hat – deren Ablauf/Dokumente werden bei jedem App-Start still aufgefrischt, damit die
 * Offline-Kopie Änderungen mitbekommt. Läuft leise, je Gottesdienst einmal pro Sitzung.
 */
export function useOfflineAutoSync(services: Service[] | undefined): void {
  const synced = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!services || services.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = services
      .filter((s) => s.date >= today)
      .sort((a, b) => a.start.localeCompare(b.start));

    // Nächster GD (Schalter) + alle bereits offline gehaltenen kommenden GDs (aktuell halten).
    const reg = getOfflineRegistry();
    const targets: Service[] = [];
    if (isOfflineAutoEnabled() && upcoming[0]) targets.push(upcoming[0]);
    for (const s of upcoming) {
      if (reg[s.id] && !targets.some((t) => t.id === s.id)) targets.push(s);
    }

    const todo = targets.filter((s) => !synced.current.has(s.id));
    if (todo.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const svc of todo) {
        if (cancelled) return;
        synced.current.add(svc.id);
        try {
          const items = await queryClient.fetchQuery({
            queryKey: ['agenda', svc.id],
            queryFn: () => api.getAgenda(svc.id),
          });
          if (!cancelled) await saveServiceOffline({ id: svc.id, date: svc.date }, items);
        } catch {
          synced.current.delete(svc.id); // bei Fehler (z. B. kurz offline) später erneut versuchen
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [services]);
}
