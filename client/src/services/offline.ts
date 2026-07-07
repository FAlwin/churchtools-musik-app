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

/**
 * „Für offline speichern": lädt (online) alle Dokumente (PDF/Bild) des Ablaufs in den
 * Service-Worker-Datei-Cache, schreibt danach die Daten (Termine/Ablauf/ChordPro) sofort nach
 * IndexedDB und trägt den Gottesdienst ins Offline-Verzeichnis ein. Danach ist er im Saal auch
 * ohne Netz verfügbar (#32). Einzelne fehlschlagende Dateien werden übersprungen.
 */
export async function saveServiceOffline(
  service: { id: number; date: string },
  items: AgendaItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const urls: string[] = [];
  for (const it of items) {
    if (it.song)
      for (const doc of it.song.documents)
        urls.push(`/api/songs/${it.song.id}/files/${doc.fileId}`);
  }
  let done = 0;
  onProgress?.(0, urls.length);
  await mapLimit(urls, 4, async (url) => {
    try {
      await fetch(url, { credentials: 'include' });
    } catch {
      /* einzelne Datei nicht erreichbar → überspringen */
    }
    onProgress?.(++done, urls.length);
  });
  await saveOfflineNow();
  markServiceOffline(service.id, service.date);
}
