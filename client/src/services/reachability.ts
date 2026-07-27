/**
 * Echte Server-Erreichbarkeit (#32). `navigator.onLine` sagt nur, ob eine Netzwerk-Schnittstelle
 * aktiv ist – im Gemeinde-WLAN OHNE Internet/Server-Zugang meldet es fälschlich „online". Deshalb
 * leiten wir den Zustand aus den TATSÄCHLICHEN API-Aufrufen ab: schlägt ein Aufruf mit
 * Netzwerkfehler fehl → nicht erreichbar; kommt eine Antwort (auch ein HTTP-Fehler wie 401) → der
 * Server ist erreichbar. `apiFetch` meldet beides hierher; die Oberfläche liest es über useOnlineStatus.
 */
import { BASE } from './apiBase';

let reachable = true;
const listeners = new Set<(v: boolean) => void>();

export function getReachable(): boolean {
  return reachable;
}

export function markReachable(v: boolean): void {
  if (reachable === v) return;
  reachable = v;
  for (const fn of listeners) fn(v);
}

export function subscribeReachable(fn: (v: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Aktiv nachsehen, ob der Server wieder da ist (#218).
 *
 * Bis v2.14.1 wurde `reachable` NUR aus `apiFetch` gesetzt – der Zustand kannte also den Weg nach
 * „false", aber zurück nur durch Zufall: Auf dem Login-Screen laufen keine Queries, deshalb blieb
 * der Offline-Hinweis nach dem Zurückkehren ins Netz kleben, und nur ein App-Neustart half.
 *
 * Bewusst mit blankem `fetch` statt `apiFetch`: Diese Prüfung soll KEINE Nebenwirkungen haben
 * (kein 401-Fänger, keine Fehlermeldung) – sie fragt nur, ob der Server antwortet. `/api/health`
 * ist dafür der billigste Endpunkt und braucht keine Anmeldung.
 */
let probing: Promise<boolean> | null = null;
export function probeReachable(): Promise<boolean> {
  // Mehrfachaufrufe (online-Event + Sichtbarkeit + Anmeldeversuch) bündeln.
  if (probing) return probing;
  probing = (async () => {
    try {
      const res = await fetch(`${BASE}/api/health`, { cache: 'no-store' });
      // Jede Antwort heißt „Server erreichbar" – außer den Vorschalt-Fehlern des Reverse-Proxys,
      // die genau wie in `apiFetch` als „unser Backend fehlt" gelten.
      const ok = ![502, 503, 504].includes(res.status);
      markReachable(ok);
      return ok;
    } catch {
      markReachable(false);
      return false;
    } finally {
      probing = null;
    }
  })();
  return probing;
}
