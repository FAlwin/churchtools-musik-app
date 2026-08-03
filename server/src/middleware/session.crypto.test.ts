import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  setSession,
  readSession,
  isEncryptedCtCookie,
  sessionRateKey,
  dropUnusableSessionCookie,
} from './session.js';

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

/**
 * #268: Ein unbrauchbares Cookie muss **weg**, nicht nur ignoriert werden.
 *
 * Vorher behandelten `getMe` und `requireSession` es wie „nicht angemeldet" – ohne es zu löschen. Der
 * Browser schickte es damit bei jeder weiteren Anfrage wieder mit, und die App hing in einem
 * Zwischenzustand, aus dem nur Ab- und Neuanmelden half. Zwei Wege dorthin, beide erst seit #194
 * möglich: gewechseltes `SESSION_SECRET` (Signatur passt nicht → `cookie-parser` legt `false` ab) und
 * ein CT-Anteil, der sich nicht entschlüsseln lässt.
 */
describe('dropUnusableSessionCookie – totes Cookie einmal loswerden (#268)', () => {
  /** Request + Response wie in der Middleware-Kette, mit Zähler auf `clearCookie`/`next`. */
  function chain(signedCookies: Record<string, unknown>) {
    const clearCookie = vi.fn();
    const next = vi.fn();
    dropUnusableSessionCookie(
      { signedCookies } as unknown as Request,
      { clearCookie } as unknown as Response,
      next,
    );
    return { clearCookie, next };
  }

  it('löscht es, wenn die Signatur nicht passt (gewechseltes SESSION_SECRET)', () => {
    // Das ist der Fall, der beim Rotieren des Secrets ALLE Geräte trifft.
    const { clearCookie } = chain({ ct_session: false });
    expect(clearCookie).toHaveBeenCalledWith('ct_session', expect.objectContaining({ path: '/' }));
  });

  it('löscht es, wenn der verschlüsselte Anteil nicht entschlüsselbar ist', () => {
    const { clearCookie } = chain({ ct_session: '1750000000000|u42|e1:VoellsigerUnsinn' });
    expect(clearCookie).toHaveBeenCalledOnce();
  });

  it('lässt ein gültiges Cookie in Ruhe', () => {
    const { res, cookie } = fakeRes();
    setSession(res, CT, Date.now(), 42);
    const { clearCookie } = chain({ ct_session: String(cookie.mock.calls[0][1]) });
    expect(clearCookie).not.toHaveBeenCalled();
  });

  it('lässt ein Bestands-Cookie im Klartext in Ruhe (niemand wird abgemeldet)', () => {
    // Sonst hätte der Fix genau das kaputt gemacht, was #194 bewusst erhalten hat.
    const { clearCookie } = chain({ ct_session: `1750000000000|u7|${CT}` });
    expect(clearCookie).not.toHaveBeenCalled();
  });

  it('tut nichts, wenn gar kein solches Cookie dabei ist', () => {
    expect(chain({}).clearCookie).not.toHaveBeenCalled();
  });

  it('gibt in jedem Fall an die nächste Middleware weiter', () => {
    // Ein Fehler hier würde die ganze API blockieren – also ausdrücklich festhalten.
    expect(chain({}).next).toHaveBeenCalledOnce();
    expect(chain({ ct_session: false }).next).toHaveBeenCalledOnce();
  });
});
