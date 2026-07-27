import { describe, it, expect } from 'vitest';
import { loginErrorMessage, isConnectionProblem } from './loginError';
import { ApiError } from '../services/api';

/**
 * #218: Vorher bekam JEDER fehlgeschlagene Anmeldeversuch die Meldung „Bitte E-Mail und Passwort
 * prüfen" – auch ein Verbindungsproblem. Entscheidend ist: ein Netzwerkfehler ist KEIN ApiError.
 */
describe('loginErrorMessage', () => {
  it('401: sagt, dass die Zugangsdaten nicht stimmen (Server-Klartext)', () => {
    expect(loginErrorMessage(new ApiError(401, 'E-Mail oder Passwort falsch.'))).toBe(
      'E-Mail oder Passwort falsch.',
    );
  });

  it('429: benennt die Sperre nach zu vielen Versuchen', () => {
    const msg = loginErrorMessage(new ApiError(429, 'Zu viele Anmeldeversuche.'));
    expect(msg).toMatch(/zu viele anmeldeversuche/i);
    expect(msg).toMatch(/warten/i);
  });

  it('5xx: entlastet ausdrücklich das Passwort', () => {
    const msg = loginErrorMessage(new ApiError(502, 'Fehler 502'));
    expect(msg).toMatch(/server/i);
    expect(msg).toMatch(/nicht am passwort|am passwort liegt es nicht/i);
  });

  it('Netzwerkfehler (kein ApiError): nennt das Verbindungsproblem', () => {
    const msg = loginErrorMessage(new TypeError('Failed to fetch'));
    expect(msg).toMatch(/verbindung/i);
    expect(msg).toMatch(/am passwort liegt es nicht/i);
  });

  it('zeigt bei 401 NIE eine Verbindungsmeldung (und umgekehrt)', () => {
    expect(loginErrorMessage(new ApiError(401, 'falsch'))).not.toMatch(/verbindung/i);
    expect(loginErrorMessage(new TypeError('x'))).not.toMatch(/passwort prüfen/i);
  });
});

describe('isConnectionProblem', () => {
  it('Netzwerkfehler und 5xx gelten als Verbindungsproblem (→ Erreichbarkeit neu prüfen)', () => {
    expect(isConnectionProblem(new TypeError('Failed to fetch'))).toBe(true);
    expect(isConnectionProblem(new ApiError(503, 'weg'))).toBe(true);
  });

  it('401/429 sind KEIN Verbindungsproblem', () => {
    expect(isConnectionProblem(new ApiError(401, 'falsch'))).toBe(false);
    expect(isConnectionProblem(new ApiError(429, 'zu viele'))).toBe(false);
  });
});
