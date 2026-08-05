/**
 * „Die App wird weggelegt" – ein Ort für die zwei Ereignisse, auf die es dabei ankommt (#275).
 *
 * iOS friert beim Backgrounding die laufenden Timer ein. Wer eine Änderung erst nach einer
 * Debounce-Pause abschickt, verliert sie deshalb, wenn der Nutzer die App vorher weg-wischt – der
 * Timer feuert nie wieder. Beide Sync-Dienste müssen ihre Warteschlange an dieser Stelle also
 * **sofort** abschicken (mit `keepalive`, damit der Request das Backgrounding übersteht).
 *
 * `visibilitychange` deckt den Wechsel in den Hintergrund ab, `pagehide` das echte Schließen. Beide
 * können feuern – die Aufrufer müssen mit einem doppelten Aufruf zurechtkommen (tun sie: eine leere
 * Warteschlange ist ein No-op).
 *
 * Eigene Datei, weil die Registrierung sonst in jedem Dienst noch einmal dastünde: Bei den
 * Anmerkungen gab es sie schon, bei den Einstellungen fehlte sie – genau die Art halb umgesetzter
 * Regel, die dieses Projekt mehrfach Daten gekostet hat.
 */
export function onAppHidden(fn: () => void): void {
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') fn();
  });
  window.addEventListener('pagehide', fn);
}
