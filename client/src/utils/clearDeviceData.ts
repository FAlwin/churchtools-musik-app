import { clearPersistedCache } from '../queryClient';
import { clearOfflineRegistry } from '../services/offline';

/**
 * Räumt beim ABMELDEN die auf dem Gerät liegenden Konto-Daten weg (wichtig für geteilte
 * Gemeinde-Geräte): persistierter Query-Cache in IndexedDB (Abläufe mit Personennamen,
 * ChordPro), der Datei-Cache des Service Workers (PDFs/Bilder), das Offline-Verzeichnis und
 * die lokalen Daten-Caches in localStorage (Anmerkungen/Zoom/Lied-Einstellungen – alles pro
 * Konto auf dem Server gesichert und beim nächsten Login wiederhergestellt).
 *
 * BLEIBT erhalten (bewusst, reine Geräte-Einstellungen ohne Personenbezug): `worship:*`-
 * Präferenzen (Einführung-gesehen, Offline-Automatik-Schalter; der Navigations-Stand
 * `worship:nav-v1` wird beim Logout separat von useAppNav geleert) und `musikapp:kbHeight`.
 */
export async function clearDeviceData(): Promise<void> {
  // localStorage: alle Daten-Caches (Unterstrich-Präfix `worship_…` = Konto-Daten;
  // Doppelpunkt-Präfix `worship:…` = Geräte-Präferenzen, bleiben).
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('worship_')) localStorage.removeItem(k);
    }
  } catch {
    /* Speicher nicht verfügbar */
  }
  clearOfflineRegistry();
  try {
    await clearPersistedCache();
  } catch {
    /* IndexedDB nicht verfügbar */
  }
  try {
    if (typeof caches !== 'undefined') await caches.delete('worship-files');
  } catch {
    /* Cache-API nicht verfügbar */
  }
}
