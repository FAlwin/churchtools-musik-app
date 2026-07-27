import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { ipRateKey } from './utils/ipKey.js';

/**
 * #214: Von `trust proxy` hängt die gesamte IP-Härtung ab – vor allem das Login-Limit, das mangels
 * Session nur die IP hat. Mit der festen `1` war es eine ungeprüfte Annahme über die Proxy-Kette:
 * Steht noch ein lokaler Hop dazwischen, ist `req.ip` immer `127.0.0.1`, und ALLE Anfragen der Welt
 * teilen einen Rate-Limit-Schlüssel (von außen auslösbare Login-Sperre für die ganze Gemeinde).
 *
 * Dieser Test startet einen echten Express-Server auf einem freien Port und schickt Anfragen mit
 * `X-Forwarded-For` – die Anfragen kommen dabei tatsächlich von 127.0.0.1, genau wie hinter dem
 * Reverse-Proxy auf dem NAS.
 */
let server: Server | null = null;

/** Startet einen Mini-Server mit der gewünschten trust-proxy-Einstellung; liefert die Basis-URL. */
async function startWith(trust: string | number): Promise<string> {
  const app = express();
  app.set('trust proxy', trust);
  app.get('/ip', (req, res) => res.json({ ip: req.ip, key: ipRateKey(req.ip) }));
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function ipFor(base: string, forwarded?: string): Promise<{ ip: string; key: string }> {
  const res = await fetch(
    `${base}/ip`,
    forwarded ? { headers: { 'X-Forwarded-For': forwarded } } : {},
  );
  return (await res.json()) as { ip: string; key: string };
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

describe("trust proxy: 'loopback' (#214)", () => {
  it('EIN Proxy-Hop: die echte Client-IP kommt an', async () => {
    const base = await startWith('loopback');
    expect((await ipFor(base, '203.0.113.7')).ip).toBe('203.0.113.7');
  });

  it('ZWEI lokale Hops: die echte Client-IP kommt trotzdem an', async () => {
    // Genau der Fall, den die feste `1` falsch behandelt hätte (z. B. Tunnel → Reverse-Proxy).
    const base = await startWith('loopback');
    expect((await ipFor(base, '203.0.113.7, 127.0.0.1')).ip).toBe('203.0.113.7');
  });

  it('ohne Proxy-Header bleibt es die direkte Verbindung', async () => {
    const base = await startWith('loopback');
    expect((await ipFor(base)).ip).toMatch(/127\.0\.0\.1$/);
  });

  it('Gegenprobe: mit `1` kippt der Zwei-Hop-Fall auf 127.0.0.1 (die alte Lücke)', async () => {
    const base = await startWith(1);
    expect((await ipFor(base, '203.0.113.7, 127.0.0.1')).ip).toMatch(/127\.0\.0\.1$/);
  });

  it('zusammen mit ipRateKey: ein IPv6-Anschluss teilt EINEN Schlüssel', async () => {
    const base = await startWith('loopback');
    const a = await ipFor(base, '2001:db8:abcd:12::1');
    const b = await ipFor(base, '2001:db8:abcd:12::99');
    const fremd = await ipFor(base, '2001:db8:abcd:13::1');
    expect(a.key).toBe(b.key);
    expect(a.key).not.toBe(fremd.key);
  });
});
