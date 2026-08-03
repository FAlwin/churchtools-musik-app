// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pushField,
  pullAnnotations,
  resetSync,
  setAnnotationsSyncErrorHandler,
  resumePendingAnnotations,
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

/**
 * #256: Die Warteschlange lebte nur im Speicher. Zeichnete jemand offline und wurde die App danach
 * beendet, war beim nächsten Start nicht mehr bekannt, dass etwas fehlt – der erste `pullAnnotations`
 * spiegelte den älteren Server-Stand über den lokalen und der Strich verschwand.
 *
 * Der Merker liegt jetzt in localStorage. Ein „Neustart" wird hier simuliert, indem nur der
 * Modul-Zustand zurückgesetzt wird (`resetSync` + neue Testdatei-Instanz ist nicht nötig – die
 * Speicher-Warteschlange ist nach einem fehlgeschlagenen Flush ohnehin leer, sobald der Merker greift).
 */
describe('annotations – ausstehender Upload übersteht den Neustart (#256)', () => {
  const PENDING = 'worship_anno_pending_v1';

  it('ein ausstehender Schlüssel steht im Merker – und ist nach Erfolg wieder weg', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(500)));
    vi.stubGlobal('fetch', fetchMock);

    pushField(`${DRAW}${KEY}`, 'strokes', 'STRICH');
    expect(JSON.parse(localStorage.getItem(PENDING) ?? '[]')).toContain(KEY);

    await runFlush(); // scheitert → Merker MUSS bleiben
    expect(JSON.parse(localStorage.getItem(PENDING) ?? '[]')).toContain(KEY);

    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(200)));
    await vi.advanceTimersByTimeAsync(5100); // Wiederholung
    expect(localStorage.getItem(PENDING)).toBeNull();
  });

  it('DER Fall von #256: nach einem ECHTEN Neustart gewinnt der lokale Stand, nicht der Server', async () => {
    // 1) Offline zeichnen, Upload scheitert.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    markReachable(false);
    localStorage.setItem(`${DRAW}${KEY}`, 'OFFLINE_GEZEICHNET');
    pushField(`${DRAW}${KEY}`, 'strokes', 'OFFLINE_GEZEICHNET');
    await runFlush();
    expect(JSON.parse(localStorage.getItem(PENDING) ?? '[]')).toContain(KEY);

    // 2) ECHTER Neustart: das Modul frisch laden. Nur `resetSync()` genügt NICHT – dann stünde der
    // Schlüssel noch in der Speicher-Warteschlange und der Pull-Schutz käme von dort statt vom
    // Merker (so war eine frühere Fassung dieses Tests grün, ohne etwas zu prüfen).
    vi.resetModules();
    const frisch = await import('./annotations');
    markReachable(true);

    // 3) Der Pull liefert den ÄLTEREN Serverstand.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') return Promise.resolve(jsonResponse(200));
        return Promise.resolve(jsonResponse(200, { [KEY]: { strokes: 'ALTER_SERVER_STAND' } }));
      }),
    );
    await frisch.pullAnnotations([7]);

    // Der lokale Strich überlebt – nur dank des Merkers in localStorage.
    expect(localStorage.getItem(`${DRAW}${KEY}`)).toBe('OFFLINE_GEZEICHNET');
  });

  it('die Wiederaufnahme lädt den lokalen Stand hoch und räumt den Merker', async () => {
    localStorage.setItem(PENDING, JSON.stringify([KEY]));
    localStorage.setItem(`${DRAW}${KEY}`, 'NACHZUTRAGEN');
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200)));
    vi.stubGlobal('fetch', fetchMock);

    await resumePendingAnnotations();

    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as Record<string, unknown>;
    expect(sent.strokes).toBe('NACHZUTRAGEN');
    expect(localStorage.getItem(PENDING)).toBeNull();
  });

  it('ein Merker ohne lokale Daten wird nur aufgeräumt (Anmerkung wurde gelöscht)', async () => {
    localStorage.setItem(PENDING, JSON.stringify(['song9_voriginal_0']));
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200)));
    vi.stubGlobal('fetch', fetchMock);

    await resumePendingAnnotations();

    expect(putCount(fetchMock)).toBe(0);
    expect(localStorage.getItem(PENDING)).toBeNull();
  });

  it('413 räumt den Merker – sonst versucht es jeder Start erneut', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(413, { error: 'voll' }))),
    );
    pushField(`${DRAW}${KEY}`, 'strokes', 'ZU_GROSS');
    await runFlush();
    expect(localStorage.getItem(PENDING)).toBeNull();
  });
});
