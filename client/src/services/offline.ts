import type { AgendaItem } from '@shared/types/index';
import { saveOfflineNow } from '../queryClient';

/** Führt `fn` über alle Einträge aus, aber höchstens `limit` gleichzeitig (schont Gerät/Netz). */
async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

// ── Offline-Verzeichnis: welcher Gottesdienst liegt (vollständig) offline vor? ────────────────
// Dauerhaft in localStorage – Grundlage für das Offline-Symbol am Termin, das Ausgrauen ohne Netz
// und das Aktuell-Halten gespeicherter Gottesdienste. Ohne Verzeichnis „rät" die App nur.

export interface OfflineRegEntry {
  /** Zeitpunkt der letzten vollständigen Speicherung (ms). */
  savedAt: number;
  /** Datum des Gottesdienstes (JJJJ-MM-TT) – zum Aufräumen vergangener Einträge. */
  date: string;
}

const REG_KEY = 'worship:offline-services';
/** Ereignis, mit dem sich die Oberfläche (Hook) über Verzeichnis-Änderungen informieren lässt. */
export const OFFLINE_REG_EVENT = 'worship:offline-services-changed';

export function getOfflineRegistry(): Record<number, OfflineRegEntry> {
  try {
    const raw = localStorage.getItem(REG_KEY);
    return raw ? (JSON.parse(raw) as Record<number, OfflineRegEntry>) : {};
  } catch {
    return {};
  }
}

function writeRegistry(reg: Record<number, OfflineRegEntry>): void {
  try {
    localStorage.setItem(REG_KEY, JSON.stringify(reg));
  } catch {
    /* Speicher nicht verfügbar */
  }
  window.dispatchEvent(new Event(OFFLINE_REG_EVENT));
}

function markServiceOffline(serviceId: number, date: string): void {
  const reg = getOfflineRegistry();
  reg[serviceId] = { savedAt: Date.now(), date };
  writeRegistry(reg);
}

/** Verzeichnis komplett leeren (Abmelde-Aufräumen, utils/clearDeviceData). */
export function clearOfflineRegistry(): void {
  writeRegistry({});
}

/** Vergangene Gottesdienste aus dem Verzeichnis räumen (ihr Datei-Cache läuft separat ab). */
export function pruneOfflineRegistry(): void {
  const today = new Date().toISOString().slice(0, 10);
  const reg = getOfflineRegistry();
  let changed = false;
  for (const [id, e] of Object.entries(reg)) {
    if (e.date < today) {
      delete reg[Number(id)];
      changed = true;
    }
  }
  if (changed) writeRegistry(reg);
}

/** Ergebnis einer Offline-Speicherung – wie viele Dokumente NICHT geladen werden konnten (#277). */
export interface OfflineSaveResult {
  /** Anzahl der Dokumente des Ablaufs. */
  total: number;
  /** Davon nicht geladen (Serverfehler, Netz weg, ChurchTools-Aussetzer). */
  failed: number;
}

/**
 * „Für offline speichern": lädt (online) alle Dokumente (PDF/Bild) des Ablaufs in den
 * Service-Worker-Datei-Cache, schreibt danach die Daten (Termine/Ablauf/ChordPro) sofort nach
 * IndexedDB und trägt den Gottesdienst ins Offline-Verzeichnis ein. Danach ist er im Saal auch
 * ohne Netz verfügbar (#32).
 *
 * **Fehlgeschlagene Dateien werden gezählt und gemeldet (#277).** Vorher wurden sie schlicht
 * übersprungen – und zwar zusätzlich unbemerkt: `await fetch(url)` wirft bei **502/504 nicht**, und
 * `res.ok` wurde nie geprüft. Danach wurde der Gottesdienst bedingungslos als „vollständig
 * gespeichert" eingetragen. Wer sich darauf verließ, stand im Saal ohne Dokumente – also genau in der
 * Lage, für die das Feature gebaut wurde.
 *
 * Der Eintrag ins Verzeichnis erfolgt deshalb nur bei **vollständigem** Erfolg (das Feld heißt
 * `savedAt` = „letzte vollständige Speicherung"). Die Daten und die geglückten Dateien bleiben
 * trotzdem im Cache – ein erneuter Versuch lädt nur das Fehlende nach.
 */
export async function saveServiceOffline(
  service: { id: number; date: string },
  items: AgendaItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<OfflineSaveResult> {
  const urls: string[] = [];
  for (const it of items) {
    if (it.song)
      for (const doc of it.song.documents)
        urls.push(`/api/songs/${it.song.id}/files/${doc.fileId}`);
  }
  let done = 0;
  let failed = 0;
  onProgress?.(0, urls.length);
  await mapLimit(urls, 4, async (url) => {
    try {
      const res = await fetch(url, { credentials: 'include' });
      // `fetch` wirft nur bei Netzfehlern – ein 502/504 kommt als normale Antwort zurück.
      if (!res.ok) failed++;
    } catch {
      failed++;
    }
    onProgress?.(++done, urls.length);
  });
  await saveOfflineNow();
  if (failed === 0) markServiceOffline(service.id, service.date);
  return { total: urls.length, failed };
}
