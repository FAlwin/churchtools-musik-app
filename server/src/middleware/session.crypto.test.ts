import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { setSession, readSession, isEncryptedCtCookie, sessionRateKey } from './session.js';

/**
 * #194: Das App-Cookie war signiert und `httpOnly`, aber **nicht verschlüsselt** – wer es erlangte
 * (Backup, Proxy-Log, verlorenes iPad), konnte daraus das rohe ChurchTools-Cookie herauslesen und
 * damit direkt gegen ChurchTools arbeiten. Jetzt ist der CT-Anteil AES-256-GCM-verschlüsselt.
 *
 * Zwei Dinge müssen dabei unbedingt gelten:
 *  - **Niemand wird durch das Update abgemeldet.** Bestandsformate (unverschlüsselt) müssen weiter
 *    gelesen werden.
 *  - **Der Rate-Limit-Schlüssel bleibt stabil.** Jeder verschlüsselte Wert enthält einen neuen
 *    Zufalls-IV; wäre er der Schlüssel, wäre das Limit still wirkungslos.
 */
const CT = 'ChurchTools_sid=geheim123';

/** Fängt das gesetzte Cookie ab (wie es beim Browser landen würde). */
function fakeRes(): { res: Response; cookie: ReturnType<typeof vi.fn> } {
  const cookie = vi.fn();
  return { res: { cookie } as unknown as Response, cookie };
}

/** Baut einen Request, der das (signiert gelesene) Cookie liefert. */
const reqWith = (value: string): Request =>
  ({ signedCookies: { ct_session: value } }) as unknown as Request;

describe('Session-Cookie – der CT-Anteil ist verschlüsselt (#194)', () => {
  it('im gesetzten Cookie steht das ChurchTools-Cookie NICHT im Klartext', () => {
    const { res, cookie } = fakeRes();
    setSession(res, CT, 1_750_000_000_000, 42);

    const value = String(cookie.mock.calls[0][1]);
    expect(value).not.toContain(CT);
    expect(value).not.toContain('geheim123');
    // Zeitstempel und Konto-ID bleiben lesbar – daran hängen Ablauf-Prüfung und Rechte-Cache.
    expect(value.startsWith('1750000000000|u42|')).toBe(true);
    expect(isEncryptedCtCookie(value.split('|').slice(2).join('|'))).toBe(true);
  });

  it('Hin- und Rückweg ergibt dasselbe ChurchTools-Cookie', () => {
    const { res, cookie } = fakeRes();
    setSession(res, CT, 1_750_000_000_000, 42);
    const session = readSession(reqWith(String(cookie.mock.calls[0][1])));

    expect(session).not.toBeNull();
    expect(session!.ctCookie).toBe(CT);
    expect(session!.userId).toBe(42);
    expect(session!.issuedAt).toBe(1_750_000_000_000);
  });

  it('jedes Setzen erzeugt einen ANDEREN Wert (frischer Zufalls-IV)', () => {
    const a = fakeRes();
    const b = fakeRes();
    setSession(a.res, CT, 1_750_000_000_000, 42);
    setSession(b.res, CT, 1_750_000_000_000, 42);
    expect(String(a.cookie.mock.calls[0][1])).not.toBe(String(b.cookie.mock.calls[0][1]));
  });

  it('ein manipulierter Wert gilt als KEINE Session (nicht als Klartext missdeutet)', () => {
    const { res, cookie } = fakeRes();
    setSession(res, CT, 1_750_000_000_000, 42);
    const value = String(cookie.mock.calls[0][1]);
    // Ein Zeichen im verschlüsselten Teil kippen – GCM erkennt das.
    const kaputt = value.slice(0, -3) + (value.slice(-3) === 'AAA' ? 'BBB' : 'AAA');
    expect(readSession(reqWith(kaputt))).toBeNull();
  });
});

describe('Bestandsformate – niemand wird durch das Update abgemeldet (#194)', () => {
  it('ein unverschlüsseltes Cookie mit Konto-ID wird weiter gelesen', () => {
    const session = readSession(reqWith(`1750000000000|u7|${CT}`));
    expect(session?.ctCookie).toBe(CT);
    expect(session?.userId).toBe(7);
  });

  it('ein unverschlüsseltes Cookie ohne Konto-ID wird weiter gelesen', () => {
    const session = readSession(reqWith(`1750000000000|${CT}`));
    expect(session?.ctCookie).toBe(CT);
    expect(session?.userId).toBeNull();
  });

  it('das älteste Format (nur das CT-Cookie) wird weiter gelesen', () => {
    const session = readSession(reqWith(CT));
    expect(session?.ctCookie).toBe(CT);
  });

  it('ohne Cookie gibt es keine Session', () => {
    expect(readSession({ signedCookies: {} } as unknown as Request)).toBeNull();
    expect(readSession({} as unknown as Request)).toBeNull();
  });
});

describe('sessionRateKey – stabil trotz wechselnder Verschlüsselung (#194/N1)', () => {
  it('zwei verschiedene Cookie-Werte derselben Sitzung ergeben DENSELBEN Schlüssel', () => {
    // Das ist der Kern: Ohne diese Stabilität wäre das Rate-Limit wirkungslos, weil jede Anfrage
    // ein neu verschlüsseltes Cookie zurückbekommt.
    const a = fakeRes();
    const b = fakeRes();
    setSession(a.res, CT, 1_750_000_000_000, 42);
    setSession(b.res, CT, 1_750_000_000_000, 42);
    const keyA = sessionRateKey(reqWith(String(a.cookie.mock.calls[0][1])));
    const keyB = sessionRateKey(reqWith(String(b.cookie.mock.calls[0][1])));

    expect(keyA).toBe('u42');
    expect(keyB).toBe(keyA);
  });

  it('verschiedene Konten bekommen verschiedene Schlüssel', () => {
    const a = fakeRes();
    const b = fakeRes();
    setSession(a.res, CT, 1_750_000_000_000, 42);
    setSession(b.res, CT, 1_750_000_000_000, 43);
    expect(sessionRateKey(reqWith(String(a.cookie.mock.calls[0][1])))).not.toBe(
      sessionRateKey(reqWith(String(b.cookie.mock.calls[0][1]))),
    );
  });

  it('ohne Konto-ID ein Fingerprint – und NIEMALS das Cookie selbst', () => {
    const key = sessionRateKey(reqWith(`1750000000000|${CT}`));
    expect(key).toMatch(/^c[0-9a-f]{16}$/);
    expect(key).not.toContain('geheim123');
  });

  it('ohne Session kein Schlüssel (dann greift die IP-Variante)', () => {
    expect(sessionRateKey({ signedCookies: {} } as unknown as Request)).toBeNull();
  });
});
