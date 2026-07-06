/**
 * Echte Server-Erreichbarkeit (#32). `navigator.onLine` sagt nur, ob eine Netzwerk-Schnittstelle
 * aktiv ist – im Gemeinde-WLAN OHNE Internet/Server-Zugang meldet es fälschlich „online". Deshalb
 * leiten wir den Zustand aus den TATSÄCHLICHEN API-Aufrufen ab: schlägt ein Aufruf mit
 * Netzwerkfehler fehl → nicht erreichbar; kommt eine Antwort (auch ein HTTP-Fehler wie 401) → der
 * Server ist erreichbar. `apiFetch` meldet beides hierher; die Oberfläche liest es über useOnlineStatus.
 */
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
