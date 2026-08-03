import { describe, it, expect, vi, afterEach } from 'vitest';
import { readLimited, downloadFileText, fetchFileBytes } from './churchtools.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * #248: Der Datei-Proxy las die Datei mit `arrayBuffer()` **komplett in den Speicher** – ohne
 * Größenprüfung und ohne Zeitgrenze. Ein versehentlich in ChurchTools hochgeladener Scan von einigen
 * hundert MB hätte den Container umgelegt und damit die App für ALLE gleichzeitig; ein hängendes
 * ChurchTools hätte die Anfrage unbegrenzt blockiert.
 *
 * Geprüft wird beides: die Obergrenze (angekündigt UND tatsächlich) und dass eine
 * Zeitüberschreitung als 504 herauskommt statt als 500.
 */
const BASE = 'https://test.church.tools'; // = CHURCHTOOLS_BASE_URL aus vitest.config.ts
const FILE_URL = `${BASE}/?q=public/filedownload&id=4711`;

/** Response mit einem Rumpf, der in mehreren Häppchen kommt (wie ein echter Download). */
function streamResponse(chunks: Uint8Array[], headers: Record<string, string> = {}): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers });
}

afterEach(() => vi.restoreAllMocks());

describe('readLimited – die Obergrenze', () => {
  it('lässt eine Datei unter der Grenze durch', async () => {
    const res = streamResponse([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]);
    const buf = await readLimited(res, 100);
    expect([...buf]).toEqual([1, 2, 3, 4, 5]);
  });

  it('lehnt schon die ANGEKÜNDIGTE Größe ab, ohne zu laden', async () => {
    // Content-Length über der Grenze → gar nicht erst lesen (spart den Speicher komplett).
    const res = streamResponse([new Uint8Array(10)], { 'content-length': '999999' });
    await expect(readLimited(res, 100)).rejects.toThrow(HttpError);
    // Der Rumpf wurde nicht angefasst.
    expect(res.bodyUsed).toBe(false);
  });

  it('bricht auch ab, wenn die Ankündigung FEHLT und der Rumpf zu groß ist', async () => {
    // Der eigentliche Schutz: `Content-Length` kann fehlen oder lügen.
    const res = streamResponse([new Uint8Array(60), new Uint8Array(60)]);
    await expect(readLimited(res, 100)).rejects.toThrow(/zu groß/);
  });

  it('bricht auch ab, wenn die Ankündigung LÜGT', async () => {
    const res = streamResponse([new Uint8Array(200)], { 'content-length': '5' });
    await expect(readLimited(res, 100)).rejects.toThrow(/zu groß/);
  });

  it('genau an der Grenze ist noch in Ordnung', async () => {
    const res = streamResponse([new Uint8Array(100)]);
    expect((await readLimited(res, 100)).byteLength).toBe(100);
  });

  it('leerer Rumpf ergibt einen leeren Puffer', async () => {
    const res = new Response(null, { status: 200 });
    expect((await readLimited(res, 100)).byteLength).toBe(0);
  });
});

describe('Datei-Proxy – Zeitgrenze und Fehlerbilder (#248)', () => {
  it('eine Zeitüberschreitung wird als 504 gemeldet, nicht als 500', async () => {
    // So verhält sich `AbortSignal.timeout` beim Ablauf.
    const timeout = Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.reject(timeout)),
    );

    await expect(fetchFileBytes('cookie', FILE_URL)).rejects.toMatchObject({ status: 504 });
    await expect(downloadFileText('cookie', FILE_URL)).rejects.toMatchObject({ status: 504 });
  });

  it('gibt allen Datei-Aufrufen überhaupt eine Zeitgrenze mit', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('text', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    await downloadFileText('cookie', FILE_URL);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // Und der Cookie-Schutz von #199 bleibt erhalten.
    expect(init.redirect).toBe('manual');
  });

  it('eine zu große Datei kommt als Fehler heraus, nicht als halbe Datei', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response('x', { status: 200, headers: { 'content-length': '999999999' } }),
          ),
        ),
    );

    await expect(fetchFileBytes('cookie', FILE_URL)).rejects.toThrow(/zu groß/);
  });

  it('ein echter Fehler bleibt ein echter Fehler (wird nicht zu 504 verbogen)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.reject(new TypeError('fetch failed'))),
    );

    await expect(fetchFileBytes('cookie', FILE_URL)).rejects.toThrow(TypeError);
  });

  it('der Host-Wächter aus #199 greift weiterhin (Cookie darf die CT-Instanz nicht verlassen)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFileBytes('cookie', 'https://test.church.tools.evil.com/x')).rejects.toThrow(
      /gehört nicht zur ChurchTools-Instanz/,
    );
    // Gar nicht erst angefragt.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
