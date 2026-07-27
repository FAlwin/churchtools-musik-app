// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pushField,
  pullAnnotations,
  flushPendingAnnotations,
  resetSync,
} from './annotations';
import { setSessionExpiredHandler } from './api';

/**
 * #192: `services/annotations.ts` lag bei 13 % Abdeckung – laut den Kommentaren im Projekt die
 * häufigste Fehlerquelle. Getestet wird genau das, was hier schon Daten gekostet hat:
 *  - Felder einer Seite werden gebündelt (ein Request statt drei),
 *  - ein Pull überschreibt KEINE Seite mit noch nicht hochgeladener oder gerade laufender Änderung,
 *  - beim Verlassen der App gehen ausstehende Uploads sofort raus (sonst friert iOS die Timer ein
 *    und ein frisch gesetzter Zoom erreicht den Server nie),
 *  - Dokument-Seiten bleiben lokal.
 */
const DRAW = 'worship_docdraw_';
const ZOOM = 'worship_doczoom_';

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Fasst die PUT-Aufrufe zusammen: Schlüssel aus der URL + gesendeter Rumpf. */
function puts(mock: ReturnType<typeof vi.fn>) {
  return mock.mock.calls
    .filter((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')
    .map((c) => ({
      key: decodeURIComponent(String(c[0]).replace('/api/annotations/', '')),
      body: JSON.parse(String((c[1] as RequestInit).body)) as Record<string, unknown>,
      keepalive: (c[1] as RequestInit).keepalive === true,
    }));
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetSync();
  setSessionExpiredHandler(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetSync();
});

describe('pushField – bündeln statt spammen', () => {
  it('mehrere Felder derselben Seite gehen in EINEM Request raus', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200)));
    vi.stubGlobal('fetch', fetchMock);

    pushField(`${DRAW}song7_voriginal_0`, 'strokes', 'data:image/png;base64,AAA');
    pushField(`${DRAW}song7_voriginal_0`, 'texts', [{ id: 1, x: 1, y: 2, text: 'hi' }]);
    pushField(`${ZOOM}song7_voriginal_0`, 'zoom', { scale: 2 });
    await vi.advanceTimersByTimeAsync(700);

    const sent = puts(fetchMock);
    expect(sent).toHaveLength(1);
    expect(sent[0].key).toBe('song7_voriginal_0');
    expect(Object.keys(sent[0].body).sort()).toEqual(['strokes', 'texts', 'zoom']);
  });

  it('verschiedene Seiten bekommen eigene Requests', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200)));
    vi.stubGlobal('fetch', fetchMock);

    pushField(`${DRAW}song7_voriginal_0`, 'strokes', 'a');
    pushField(`${DRAW}song7_voriginal_1`, 'strokes', 'b');
    await vi.advanceTimersByTimeAsync(700);

    expect(puts(fetchMock).map((p) => p.key).sort()).toEqual([
      'song7_voriginal_0',
      'song7_voriginal_1',
    ]);
  });

  it('schnelle Änderungen am selben Feld ergeben einen Request mit dem LETZTEN Wert', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200)));
    vi.stubGlobal('fetch', fetchMock);

    pushField(`${ZOOM}song7_voriginal_0`, 'zoom', { scale: 1 });
    await vi.advanceTimersByTimeAsync(100);
    pushField(`${ZOOM}song7_voriginal_0`, 'zoom', { scale: 3 });
    await vi.advanceTimersByTimeAsync(700);

    const sent = puts(fetchMock);
    expect(sent).toHaveLength(1);
    expect(sent[0].body.zoom).toEqual({ scale: 3 });
  });

  it('Dokument-Seiten werden NICHT zum Server geschickt (bleiben lokal)', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200)));
    vi.stubGlobal('fetch', fetchMock);

    pushField(`${DRAW}213_0`, 'strokes', 'a'); // Dokument-Datei-ID, kein song-Schlüssel
    await vi.advanceTimersByTimeAsync(700);

    expect(puts(fetchMock)).toHaveLength(0);
  });

  it('Querformat-Zoom mit Layout-Ziffer wird gesynct (Regression zur KEY_RE-Lücke)', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200)));
    vi.stubGlobal('fetch', fetchMock);

    pushField(`${ZOOM}song7_voriginal_0_dlarge2`, 'zoom', { scale: 2 });
    await vi.advanceTimersByTimeAsync(700);

    expect(puts(fetchMock).map((p) => p.key)).toEqual(['song7_voriginal_0_dlarge2']);
  });
});

describe('pullAnnotations – lokale Änderungen nicht überschreiben', () => {
  it('überträgt Server-Stand in den lokalen Speicher', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(jsonResponse(200, { song7_voriginal_0: { strokes: 'vom-server' } })),
      ),
    );
    await pullAnnotations([7]);
    expect(localStorage.getItem(`${DRAW}song7_voriginal_0`)).toBe('vom-server');
  });

  it('lässt eine Seite mit noch nicht hochgeladener Änderung in Ruhe', async () => {
    // Genau der Datenverlust, den der Code-Kommentar beschreibt: frische Anmerkung würde sonst
    // vom (noch alten) Server-Stand überschrieben.
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        String(url).startsWith('/api/annotations?')
          ? jsonResponse(200, { song7_voriginal_0: { strokes: 'alt-vom-server' } })
          : jsonResponse(200),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    localStorage.setItem(`${DRAW}song7_voriginal_0`, 'frisch-lokal');
    pushField(`${DRAW}song7_voriginal_0`, 'strokes', 'frisch-lokal'); // liegt im Debounce
    await pullAnnotations([7]);

    expect(localStorage.getItem(`${DRAW}song7_voriginal_0`)).toBe('frisch-lokal');
  });

  it('lässt eine Seite in Ruhe, deren Upload gerade LÄUFT', async () => {
    let releaseUpload: (() => void) | undefined;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).startsWith('/api/annotations?')) {
        return Promise.resolve(jsonResponse(200, { song7_voriginal_0: { strokes: 'alt' } }));
      }
      // PUT bleibt offen, bis wir ihn freigeben → der Schlüssel ist „inflight".
      return new Promise<Response>((resolve) => {
        releaseUpload = (): void => resolve(jsonResponse(200));
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    localStorage.setItem(`${DRAW}song7_voriginal_0`, 'gerade-hochgeladen');
    pushField(`${DRAW}song7_voriginal_0`, 'strokes', 'gerade-hochgeladen');
    await vi.advanceTimersByTimeAsync(700); // Upload startet und hängt

    await pullAnnotations([7]);
    expect(localStorage.getItem(`${DRAW}song7_voriginal_0`)).toBe('gerade-hochgeladen');

    releaseUpload?.();
  });

  it('ohne Lieder wird gar nicht erst gefragt', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await pullAnnotations([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('flushPendingAnnotations – beim Verlassen der App', () => {
  it('schickt ausstehende Uploads SOFORT und mit keepalive', async () => {
    // Ohne das friert iOS die 600-ms-Timer ein und ein frisch gesetzter Zoom geht verloren.
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200)));
    vi.stubGlobal('fetch', fetchMock);

    pushField(`${ZOOM}song7_voriginal_0`, 'zoom', { scale: 2 });
    expect(puts(fetchMock)).toHaveLength(0); // Debounce läuft noch

    flushPendingAnnotations();
    await vi.advanceTimersByTimeAsync(0);

    const sent = puts(fetchMock);
    expect(sent).toHaveLength(1);
    expect(sent[0].keepalive).toBe(true);
  });

  it('ohne Ausstehendes passiert nichts', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    flushPendingAnnotations();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
