import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { COOKIE_WARNUNG, cookieSecureWarnung, sollteCookieWarnen } from './cookieSecureWarnung.js';

/**
 * #409: Eine fremde Gemeinde betreibt die App über HTTPS, setzt aber `COOKIE_SECURE` nicht – dann
 * geht das Sitzungs-Cookie ohne `secure`. Die App meldet das EINMAL im Log. Die Fälle, in denen sie
 * schweigen muss, sind genauso wichtig: Eine Warnung, die im Normalbetrieb leuchtet, wird überlesen.
 */
describe('sollteCookieWarnen', () => {
  const basis = { produktion: true, cookieSecure: false, forwardedProto: 'https', secure: false };

  it('warnt in Produktion bei HTTPS ohne COOKIE_SECURE', () => {
    expect(sollteCookieWarnen(basis)).toBe(true);
  });
  it('schweigt, wenn COOKIE_SECURE gesetzt ist', () => {
    expect(sollteCookieWarnen({ ...basis, cookieSecure: true })).toBe(false);
  });
  it('schweigt im LAN-Betrieb über HTTP', () => {
    expect(sollteCookieWarnen({ ...basis, forwardedProto: undefined })).toBe(false);
    expect(sollteCookieWarnen({ ...basis, forwardedProto: 'http' })).toBe(false);
  });
  it('schweigt außerhalb der Produktion', () => {
    expect(sollteCookieWarnen({ ...basis, produktion: false })).toBe(false);
  });
  it('liest bei mehreren Proxys den ersten Eintrag und erkennt auch req.secure', () => {
    expect(sollteCookieWarnen({ ...basis, forwardedProto: 'https, http' })).toBe(true);
    expect(sollteCookieWarnen({ ...basis, forwardedProto: undefined, secure: true })).toBe(true);
  });
});

/** Echter Server auf einem freien Port – dasselbe Muster wie `trustProxy.test.ts`. */
let server: Server | null = null;

async function starte(): Promise<string> {
  const app = express();
  app.use(cookieSecureWarnung({ produktion: true, cookieSecure: false }));
  app.get('/', (_req, res) => res.send('ok'));
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      resolve(`http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`);
    });
  });
}

describe('cookieSecureWarnung – als Middleware', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await new Promise<void>((fertig) => (server ? server.close(() => fertig()) : fertig()));
    server = null;
  });

  it('meldet genau einmal, auch bei vielen Anfragen', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const basis = await starte();

    for (let i = 0; i < 3; i++) {
      await fetch(basis, { headers: { 'X-Forwarded-Proto': 'https' } });
    }

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(COOKIE_WARNUNG);
  });

  it('meldet nichts, solange nur HTTP ankommt', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const basis = await starte();

    await fetch(basis);

    expect(warn).not.toHaveBeenCalled();
  });
});
