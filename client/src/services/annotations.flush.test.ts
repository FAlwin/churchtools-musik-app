// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pushField,
  pullAnnotations,
  resetSync,
  setAnnotationsSyncErrorHandler,
} from './annotations';
import { markReachable } from './reachability';
import { setSessionExpiredHandler } from './api';

/**
 * #245: `flush()` nahm den Eintrag VOR dem Request aus `pendingFields` und legte ihn im Fehlerfall
 * nicht zurück – es gab keinen Wiederholversuch. Danach griff der Pull-Schutz nicht mehr (der
 * Schlüssel stand weder in `pendingFields` noch in `inflight`), der nächste `pullAnnotations`
 * spiegelte den ÄLTEREN Server-Stand in den localStorage und **der Strich verschwand sichtbar**.
 *
 * Genau diese Lehre hatte `userSettings.ts` unter #213 schon gezogen – siehe
 * `userSettings.flush.test.ts`, dessen Aufbau hier bewusst übernommen ist.
 */
const DRAW = 'worship_docdraw_';
const KEY = 'song7_voriginal_0';

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function putCount(mock: ReturnType<typeof vi.fn>): number {
  return mock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'PUT').length;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetSync();
  markReachable(true);
  setSessionExpiredHandler(null);
  setAnnotationsSyncErrorHandler(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetSync();
  markReachable(true);
});

/** Debounce (600 ms) ablaufen lassen und die anhängenden Promises abarbeiten. */
async function runFlush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(700);
}

describe('annotations – Upload schlägt fehl (#245)', () => {
  it('Serverfehler: die Anmerkung geht nicht verloren und wird erneut versucht', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(500)));
    vi.stubGlobal('fetch', fetchMock);

    pushField(`${DRAW}${KEY}`, 'strokes', 'data:image/png;base64,STRICH');
    await runFlush();
    expect(putCount(fetchMock)).toBe(1);

    // Erreichbar → nach der Wartezeit erneut versuchen (vorher war der Strich einfach weg).
    await vi.advanceTimersByTimeAsync(5100);
    expect(putCount(fetchMock)).toBe(2);
    const sent = JSON.parse(String(fetchMock.mock.calls[1][1].body)) as Record<string, unknown>;
    expect(sent.strokes).toBe('data:image/png;base64,STRICH');
  });

  it('DER Fehler von #245: nach einem Fehlschlag darf der Pull die Seite NICHT überschreiben', async () => {
    // Das ist die eigentliche Ausfallkette – der Grund, warum der Strich sichtbar verschwand.
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return Promise.resolve(jsonResponse(500)); // Upload scheitert
      return Promise.resolve(jsonResponse(200, { [KEY]: { strokes: 'ALTER_SERVER_STAND' } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    localStorage.setItem(`${DRAW}${KEY}`, 'FRISCH_GEZEICHNET');
    pushField(`${DRAW}${KEY}`, 'strokes', 'FRISCH_GEZEICHNET');
    await runFlush(); // schlägt fehl

    await pullAnnotations([7]);

    expect(localStorage.getItem(`${DRAW}${KEY}`)).toBe('FRISCH_GEZEICHNET');
  });

  it('offline: kein vergebliches Dauerfunken, der Eintrag wartet', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', fetchMock);
    markReachable(false);

    pushField(`${DRAW}${KEY}`, 'strokes', 'data:image/png;base64,AAA');
    await runFlush();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(putCount(fetchMock)).toBe(1);
  });

  it('offline gezeichnet: der Pull überschreibt trotzdem nicht (Eintrag bleibt in der Schlange)', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(jsonResponse(200, { [KEY]: { strokes: 'ALTER_SERVER_STAND' } }));
    });
    vi.stubGlobal('fetch', fetchMock);
    markReachable(false);

    localStorage.setItem(`${DRAW}${KEY}`, 'OFFLINE_GEZEICHNET');
    pushField(`${DRAW}${KEY}`, 'strokes', 'OFFLINE_GEZEICHNET');
    await runFlush();

    markReachable(true);
    await pullAnnotations([7]);

    expect(localStorage.getItem(`${DRAW}${KEY}`)).toBe('OFFLINE_GEZEICHNET');
  });

  it('413 (Konto voll) meldet die Ursache statt still zu verschwinden', async () => {
    const onError = vi.fn();
    setAnnotationsSyncErrorHandler(onError);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(jsonResponse(413, { error: 'Speicher-Obergrenze erreicht.' })),
        ),
    );

    pushField(`${DRAW}${KEY}`, 'strokes', 'data:image/png;base64,AAA');
    await runFlush();

    expect(onError).toHaveBeenCalledWith('Speicher-Obergrenze erreicht.');
  });

  it('413 wird nicht endlos wiederholt', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(jsonResponse(413, { error: 'voll' })));
    vi.stubGlobal('fetch', fetchMock);

    pushField(`${DRAW}${KEY}`, 'strokes', 'data:image/png;base64,AAA');
    await runFlush();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(putCount(fetchMock)).toBe(1);
  });

  it('401 schaltet den Sync ab und wiederholt nicht', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(401)));
    vi.stubGlobal('fetch', fetchMock);

    pushField(`${DRAW}${KEY}`, 'strokes', 'data:image/png;base64,AAA');
    await runFlush();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(putCount(fetchMock)).toBe(1);
  });

  it('ein neuer Strich gewinnt gegen den zurückgelegten Stand', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(500)));
    vi.stubGlobal('fetch', fetchMock);

    pushField(`${DRAW}${KEY}`, 'strokes', 'ALT');
    await runFlush(); // schlägt fehl → 'ALT' wird zurückgelegt
    pushField(`${DRAW}${KEY}`, 'strokes', 'NEU'); // Nutzer zeichnet weiter
    await runFlush();

    const sent = JSON.parse(String(fetchMock.mock.calls.at(-1)![1].body)) as Record<
      string,
      unknown
    >;
    expect(sent.strokes).toBe('NEU');
  });

  it('ein anderes Feld überlebt neben dem neu gesetzten', async () => {
    // Zoom scheitert, danach zeichnet der Nutzer – beides muss im nächsten Request stehen.
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(500)));
    vi.stubGlobal('fetch', fetchMock);

    pushField(`${DRAW}${KEY}`, 'zoom', { x: 1, y: 2, scale: 3 });
    await runFlush(); // schlägt fehl → zoom zurückgelegt
    pushField(`${DRAW}${KEY}`, 'strokes', 'NEUER_STRICH');
    await runFlush();

    const sent = JSON.parse(String(fetchMock.mock.calls.at(-1)![1].body)) as Record<
      string,
      unknown
    >;
    expect(sent.strokes).toBe('NEUER_STRICH');
    expect(sent.zoom).toEqual({ x: 1, y: 2, scale: 3 });
  });
});
