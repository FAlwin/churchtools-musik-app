import { describe, expect, it } from 'vitest';
import { SESSION_SECRET_MIN_LAENGE, pruefeSessionSecret } from './config.js';

/**
 * Das Sitzungs-Geheimnis (Code-Check 21.09.2026).
 *
 * Aus ihm werden **beide** Schlüssel abgeleitet: die HMAC-Signatur des eigenen Cookies und der
 * AES-Schlüssel, mit dem das ChurchTools-Cookie darin liegt. Ein bekanntes Geheimnis heißt also
 * fälschbare Sitzungen UND lesbare ChurchTools-Anmeldungen. Vorher wurde nur auf „nicht leer"
 * geprüft – der 36 Zeichen lange Beispielwert aus `.env.example` ging damit durch.
 */
describe('pruefeSessionSecret', () => {
  const gut = 'a'.repeat(SESSION_SECRET_MIN_LAENGE);

  it('lässt ein ausreichend langes Geheimnis durch', () => {
    expect(pruefeSessionSecret(gut, true)).toBe(gut);
  });

  it('lehnt den Beispielwert aus .env.example ab – auch wenn er lang genug ist', () => {
    const beispiel = 'bitte-langen-zufallsstring-eintragen';
    expect(beispiel.length).toBeGreaterThanOrEqual(SESSION_SECRET_MIN_LAENGE);
    expect(() => pruefeSessionSecret(beispiel, true)).toThrow(/Beispielwert/);
  });

  it('lehnt den Entwicklungs-Rückfall in Produktion ab', () => {
    expect(() => pruefeSessionSecret('dev-only-insecure-secret', true)).toThrow();
  });

  it('lehnt ein zu kurzes Geheimnis ab und sagt die Länge', () => {
    expect(() => pruefeSessionSecret('a'.repeat(SESSION_SECRET_MIN_LAENGE - 1), true)).toThrow(
      /zu kurz/,
    );
  });

  it('zählt ohne Leerraum – ein gepolstertes kurzes Geheimnis rutscht nicht durch', () => {
    expect(() => pruefeSessionSecret('  kurz  ', true)).toThrow(/zu kurz/);
  });

  /** In der Entwicklung soll die App ohne `.env` startfähig bleiben. */
  it('prüft außerhalb der Produktion nichts', () => {
    expect(pruefeSessionSecret('kurz', false)).toBe('kurz');
    expect(pruefeSessionSecret('dev-only-insecure-secret', false)).toBe('dev-only-insecure-secret');
  });
});
