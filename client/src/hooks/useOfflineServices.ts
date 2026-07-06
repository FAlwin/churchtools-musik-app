import { useEffect, useState } from 'react';
import {
  getOfflineRegistry,
  pruneOfflineRegistry,
  OFFLINE_REG_EVENT,
  type OfflineRegEntry,
} from '../services/offline';

/**
 * Liefert das Offline-Verzeichnis (Gottesdienst-ID → gespeichert am) und hält es aktuell:
 * beim Mounten wird aufgeräumt (vergangene Einträge raus), danach folgt der Hook jedem
 * Verzeichnis-Ereignis (Speichern/Auto-Vorhalten).
 */
export function useOfflineServices(): Record<number, OfflineRegEntry> {
  const [reg, setReg] = useState<Record<number, OfflineRegEntry>>(() => {
    pruneOfflineRegistry();
    return getOfflineRegistry();
  });
  useEffect(() => {
    const update = () => setReg(getOfflineRegistry());
    window.addEventListener(OFFLINE_REG_EVENT, update);
    return () => window.removeEventListener(OFFLINE_REG_EVENT, update);
  }, []);
  return reg;
}
