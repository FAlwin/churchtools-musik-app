// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { markReachable } from './reachability';
import { setSessionExpiredHandler } from './api';

/**
 * #275: Dem Zwilling der Anmerkungen fehlten DREI Härtungen, die `annotations.ts` längst hatte.
 * Ein grep nach ihnen ergab dort 19 Treffer, hier null – der klassische Schwesterstellen-Fund.
 *
 * 1. **Merker über den App-Neustart** (#256 bei den Anmerkungen): Offline die Tonart ändern, App
 *    schließen → beim Start spiegelte `pullSettings` den älteren Server-Stand zurück, die Änderung
 *    war still weg.
 * 2. **`inflight`-Schutz**: `pending` wird VOR dem Request geleert; ein gleichzeitig laufender
 *    30-s-Pull sah nichts mehr und drehte die frische Einstellung auf den alten Wert zurück.
 * 3. **Flush beim Weglegen der App**: iOS friert den 600-ms-Timer ein – wer gleich weg-wischt,
 *    verliert die Änderung.
 *
 * Die Tests laden das Modul je Fall NEU (`vi.resetModules`), weil der Merker sonst aus dem
 * Speicher-Zustand des vorigen Tests käme und nicht aus localStorage. Genau daran wäre ein
 * „Neustart"-Test sonst wertlos – dieselbe Falle wie bei #256.
 */
const PENDING = 'worship_settings_pending_v1';
const KEY = 'worship_key_42';

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Modul frisch laden – wie ein App-Neustart, nur der localStorage bleibt. */
async function neuStarten(): Promise<typeof import('./userSettings')> {
  vi.resetModules();
  const mod = await import('./userSettings');
  mod.resetSync();
  return mod;
}

beforeEach(() => {
  localStorage.clear();
  markReachable(true);
  setSessionExpiredHandler(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Merker übersteht den App-Neustart (#275)', () => {
  it('ein gescheiterter Upload wird beim nächsten Start nachgeholt', async () => {
    vi.useFakeTimers();
    const mod = await neuStarten();
    // Offline: der Upload scheitert.
    markReachable(false);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    localStorage.setItem(KEY, 'D'); // die App schreibt den Wert lokal …
    mod.pushSetting(KEY, 'D'); // … und meldet ihn an
    await vi.advanceTimersByTimeAsync(700);

    // Der Merker liegt in localStorage – DAS ist der Unterschied zu vorher.
    expect(JSON.parse(localStorage.getItem(PENDING) ?? '[]')).toContain(KEY);

    // App neu starten, Netz wieder da.
    vi.useRealTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200));
    vi.stubGlobal('fetch', fetchMock);
    markReachable(true);
    const nachStart = await neuStarten();
    await nachStart.resumePendingSettings();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ [KEY]: 'D' });
    // Durchgegangen → Merker weg.
    expect(localStorage.getItem(PENDING)).toBeNull();
  });

  it('ein ausstehendes ENTFERNEN wird als null nachgeholt', async () => {
    // Der Wert ist lokal nicht mehr da – „fehlt" heißt hier ausdrücklich „entfernen", nicht „nichts".
    localStorage.setItem(PENDING, JSON.stringify([KEY]));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    const mod = await neuStarten();
    await mod.resumePendingSettings();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ [KEY]: null });
  });

  it('der Pull überschreibt einen noch ausstehenden Schlüssel NICHT', async () => {
    // Das ist die eigentliche Ausfallkette: Der Merker ist da, die Speicher-Warteschlange nach dem
    // Neustart leer – ohne die Prüfung gewinnt der ältere Server-Stand.
    localStorage.setItem(PENDING, JSON.stringify([KEY]));
    localStorage.setItem(KEY, 'D'); // lokal: D (noch nicht hochgeladen)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { [KEY]: 'C' })));

    const mod = await neuStarten();
    await mod.pullSettings([42]);

    expect(localStorage.getItem(KEY)).toBe('D');
  });

  it('ohne Merker spiegelt der Pull normal (keine Blockade gebaut)', async () => {
    localStorage.setItem(KEY, 'D');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { [KEY]: 'C' })));

    const mod = await neuStarten();
    await mod.pullSettings([42]);

    expect(localStorage.getItem(KEY)).toBe('C');
  });

  it('ein Unsinns-Schlüssel im Merker wird verworfen, statt endlos mitgeschleppt', async () => {
    localStorage.setItem(PENDING, JSON.stringify(['voelliger_unsinn']));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    const mod = await neuStarten();
    await mod.resumePendingSettings();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING)).toBeNull();
  });

  it('ein 413 räumt den Merker ab – sonst versucht es jeder Start erneut', async () => {
    vi.useFakeTimers();
    const mod = await neuStarten();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(413, { error: 'Obergrenze erreicht' })),
    );
    localStorage.setItem(KEY, 'D');
    mod.pushSetting(KEY, 'D');
    await vi.advanceTimersByTimeAsync(700);

    expect(localStorage.getItem(PENDING)).toBeNull();
  });
});

describe('inflight-Schutz gegen den parallelen Pull (#275)', () => {
  it('ein Pull während des laufenden Uploads dreht den frischen Wert nicht zurück', async () => {
    const mod = await neuStarten();
    // Upload hängt, bis wir ihn freigeben – so überlappt der Pull garantiert.
    let uploadFreigeben: () => void = () => {};
    const upload = new Promise<Response>((resolve) => {
      uploadFreigeben = () => resolve(jsonResponse(200));
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') return upload;
        return Promise.resolve(jsonResponse(200, { [KEY]: 'C' })); // Server kennt noch C
      }),
    );

    localStorage.setItem(KEY, 'D');
    mod.pushSetting(KEY, 'D');
    // Debounce echt ablaufen lassen (keine FakeTimers, damit der hängende Upload sauber überlappt).
    await new Promise((r) => setTimeout(r, 650));

    await mod.pullSettings([42]); // läuft, WÄHREND der Upload noch offen ist
    expect(localStorage.getItem(KEY)).toBe('D');

    uploadFreigeben();
    await upload;
  });
});

/**
 * ⚠️ Diese drei Tests laufen mit FAKE-Timern, und das ist der Kern ihrer Aussagekraft:
 *
 * Mit echten Timern feuert der 600-ms-Debounce von selbst und schickt den Request sowieso ab – der
 * Test wäre dann auch ohne die Registrierung grün. Genau das ist bei der ersten Fassung passiert und
 * fiel nur durch die getrennte Gegenprobe auf. Mit Fake-Timern kann der Debounce nicht dazwischen
 * feuern: Wird gesendet, dann NUR weil das Weglegen es ausgelöst hat.
 */
describe('Flush beim Weglegen der App (#275)', () => {
  beforeEach(() => vi.useFakeTimers());

  it('flushPendingSettings schickt sofort ab, ohne auf den Debounce zu warten', async () => {
    const mod = await neuStarten();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    localStorage.setItem(KEY, 'E');
    mod.pushSetting(KEY, 'E');
    expect(fetchMock).not.toHaveBeenCalled(); // noch in der Debounce-Pause

    mod.flushPendingSettings();
    await vi.advanceTimersByTimeAsync(0); // nur die Microtasks, KEINE 600 ms

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBe(true); // überlebt das Backgrounding
    expect(JSON.parse(String(init.body))).toEqual({ [KEY]: 'E' });
  });

  it('das Verstecken der Seite löst den Flush aus', async () => {
    const mod = await neuStarten();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    localStorage.setItem(KEY, 'F');
    mod.pushSetting(KEY, 'F');

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);

    // Nicht auf GENAU einen Aufruf geprüft: `vi.resetModules()` lässt die Listener früherer
    // Modul-Instanzen am `document` hängen. In der App wird das Modul einmal geladen – geprüft wird
    // hier die Verdrahtung, nicht die Anzahl. Ohne die Registrierung: null Aufrufe.
    expect(fetchMock).toHaveBeenCalled();
    const gesendet = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>,
    );
    expect(gesendet).toContainEqual({ [KEY]: 'F' });
  });

  it('ohne ausstehende Änderung passiert nichts', async () => {
    const mod = await neuStarten();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    mod.flushPendingSettings();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
