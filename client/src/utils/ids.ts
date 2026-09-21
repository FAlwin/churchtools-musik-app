/**
 * **Eine ID für einen neuen Listen-Eintrag** (Links im „Mehr"-Tab, Termin-Arten des Filters).
 *
 * Der Rückfall ist nötig, weil `crypto.randomUUID` nur im sicheren Kontext existiert: Im LAN-Betrieb
 * über HTTP (ohne Reverse Proxy) gibt es ihn nicht, und ohne Rückfall hätte jeder neue Eintrag dort
 * die ID `undefined` – der Server hätte sie abgelehnt.
 *
 * Bis zum 21.09.2026 stand diese Funktion wortgleich in `LinksManager` und `TerminArtenManager`,
 * obwohl der Kommentar dort „Stile geteilt, nicht kopiert" versprach (Code-Check). Das `praefix`
 * macht die Herkunft im Rückfall erkennbar – mehr ist es nicht.
 */
export function neueId(praefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${praefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
