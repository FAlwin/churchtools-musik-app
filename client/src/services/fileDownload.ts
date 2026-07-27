/**
 * Rohe Datei-Abrufe (PDF/Bild) aus dem Datei-Proxy des Servers (#199).
 *
 * Warum ein eigener Service statt `apiFetch`: Hier kommt **kein JSON** zurück, sondern Bytes –
 * `apiFetch` würde den Rumpf als Text lesen und zu parsen versuchen. Die Konvention „fetch nur in
 * `services/`" gilt trotzdem; vorher stand der Aufruf mitten in `hooks/useSetlistPages.ts`.
 */

/**
 * Lädt eine Datei **vollständig** und gibt ihre Bytes zurück.
 *
 * Bewusst ein einziger GET statt pdf.js selbst streamen zu lassen: pdf.js nutzt sonst
 * Range-Requests (Teilstücke), die den Datei-Cache des Service Workers verfehlen bzw. verwirren –
 * offline hing der Seitenaufbau dadurch rund 10 Sekunden, bis der Fallback griff (#32). Ein
 * normaler GET trifft den CacheFirst-Eintrag sauber; die Lied-PDFs sind klein, die Volllast ist
 * auch online unkritisch.
 */
export async function fetchFileBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Dokument konnte nicht geladen werden (${res.status})`);
  return res.arrayBuffer();
}
