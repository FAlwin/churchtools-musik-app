import type { AgendaItem } from '@shared/types/index';
import { saveOfflineNow } from '../queryClient';

/** Führt `fn` über alle Einträge aus, aber höchstens `limit` gleichzeitig (schont Gerät/Netz). */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

/**
 * „Für offline speichern": lädt (online) alle Dokumente (PDF/Bild) des Ablaufs in den
 * Service-Worker-Datei-Cache und schreibt danach die Daten (Termine/Ablauf/ChordPro) sofort nach
 * IndexedDB. Danach ist der Gottesdienst im Saal auch ohne Netz verfügbar (#32, Phase 2).
 * Einzelne fehlschlagende Dateien werden übersprungen (Rest wird trotzdem gespeichert).
 */
export async function saveServiceOffline(
  items: AgendaItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const urls: string[] = [];
  for (const it of items) {
    if (it.song) for (const doc of it.song.documents) urls.push(`/api/songs/${it.song.id}/files/${doc.fileId}`);
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
}
