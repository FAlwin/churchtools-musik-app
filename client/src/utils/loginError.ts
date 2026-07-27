import { ApiError } from '../services/api';

/**
 * Verständliche Meldung für einen fehlgeschlagenen Anmeldeversuch (#218).
 *
 * Vorher stand dort für JEDEN Fehler „Bitte E-Mail und Passwort prüfen." – auch bei einem
 * Verbindungsproblem. Das schickt Leute auf die falsche Fährte: Sie tippen ihr korrektes Passwort
 * immer wieder neu, während in Wahrheit der Server nicht erreichbar war.
 *
 * Ein **Netzwerkfehler ist kein `ApiError`** (dann kam gar keine Antwort) – das ist die
 * Unterscheidung, an der die Ursache hängt.
 */
export function loginErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) {
      // Klartext vom Server („E-Mail oder Passwort falsch.") ist präziser als jede eigene Formulierung.
      return e.message || 'E-Mail oder Passwort ist nicht richtig.';
    }
    if (e.status === 429) {
      return 'Zu viele Anmeldeversuche. Bitte ein paar Minuten warten und es dann erneut versuchen.';
    }
    if (e.status >= 500) {
      return 'Der Server antwortet gerade nicht. Bitte gleich noch einmal versuchen – am Passwort liegt es nicht.';
    }
    return e.message || 'Anmeldung fehlgeschlagen.';
  }
  // Kein ApiError = die Anfrage kam nicht durch (kein Netz, WLAN ohne Internet, Server weg).
  return 'Keine Verbindung zum Server. Bitte Netz prüfen und erneut versuchen – am Passwort liegt es nicht.';
}

/** War es ein Verbindungsproblem? Dann lohnt es, die Erreichbarkeit aktiv neu zu prüfen. */
export function isConnectionProblem(e: unknown): boolean {
  return !(e instanceof ApiError) || e.status >= 500;
}
