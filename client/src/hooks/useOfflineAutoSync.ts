import { useEffect, useRef } from 'react';
import type { Service } from '@shared/types/index';
import { queryClient } from '../queryClient';
import * as api from '../services/churchtoolsApi';
import { saveServiceOffline } from '../services/offline';
import { isOfflineAutoEnabled } from '../services/offlineAuto';

/**
 * Hält den nächsten kommenden Gottesdienst automatisch offline bereit (#32, Phase 2): lädt online
 * im Hintergrund dessen Ablauf + Dokumente in den Cache und schreibt die Daten nach IndexedDB –
 * ohne dass jemand „Für offline speichern" drücken muss. Läuft leise, einmal pro nächstem GD.
 */
export function useOfflineAutoSync(services: Service[] | undefined): void {
  const lastId = useRef<number | null>(null);
  useEffect(() => {
    if (!isOfflineAutoEnabled()) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!services || services.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const next = services
      .filter((s) => s.date >= today)
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    if (!next || lastId.current === next.id) return;
    lastId.current = next.id;
    let cancelled = false;
    void (async () => {
      try {
        const items = await queryClient.fetchQuery({
          queryKey: ['agenda', next.id],
          queryFn: () => api.getAgenda(next.id),
        });
        if (!cancelled) await saveServiceOffline(items);
      } catch {
        lastId.current = null; // bei Fehler (z. B. kurz offline) später erneut versuchen
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [services]);
}
