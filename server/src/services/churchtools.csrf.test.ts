import { describe, it, expect, vi, afterEach } from 'vitest';
import { __getCsrfTokenForTests as getCsrfToken } from './churchtools.js';

/**
 * #294: Das CSRF-Token wird beim Speichern automatisch EINMAL nachgefasst.
 *
 * Jede Schreibaktion holt zuerst dieses Token. Scheiterte das eine Mal (kurzer ChurchTools-Schluckauf,
 * Netz-Aussetzer), brach der ganze Speichervorgang ab und der Nutzer musste selbst noch einmal auf
 * Speichern tippen – real aufgetreten beim Bearbeiten eines Ablaufeintrags. Das Token-Holen ist ein
 * reiner GET ohne Nebenwirkung, ein zweiter Versuch also gefahrlos.
 *
 * Ein 401/403 (tote Session) wird NICHT wiederholt – das ändert sich nicht und würde nur den Login
 * verzögern.
 *
 * Fake-Timer, damit die 300-ms-Pause den Test nicht bremst UND damit belegt ist, dass die Pause
 * wirklich dazwischen liegt.
 */
const COOKIE = 'ChurchTools_sid=abc';

function jsonRes(body: unknown, status = 200): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  // `fetchCsrfTokenOnce` liest seit #296 den Body über `res.text()` (Erfolgsfall JSON.parse,
  // Fehlerfall fürs Log) – der Mock muss beides können.
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Lässt die Retry-Pause ablaufen und die Microtasks durch. */
async function laufenLassen<T>(p: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(500);
  return p;
}

describe('getCsrfToken – ein automatischer Wiederholversuch (#294)', () => {
  it('klappt der erste Versuch, wird NICHT wiederholt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ data: 'token-1' }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await getCsrfToken(COOKIE)).toBe('token-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ein vorübergehender Serverfehler (502) beim ersten Mal wird nachgefasst', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ message: 'weg' }, 502))
      .mockResolvedValueOnce(jsonRes({ data: 'token-2' }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await laufenLassen(getCsrfToken(COOKIE))).toBe('token-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ein Netzfehler (fetch wirft) beim ersten Mal wird nachgefasst', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(jsonRes({ data: 'token-3' }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await laufenLassen(getCsrfToken(COOKIE))).toBe('token-3');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('scheitern BEIDE Versuche, fliegt der Fehler des zweiten (nicht endlos)', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ message: 'weg' }, 502));
    vi.stubGlobal('fetch', fetchMock);

    // Die Assertion MUSS am Promise hängen, BEVOR die Retry-Pause abläuft – sonst rejectet es
    // dazwischen ohne Handler (unhandled rejection).
    const p = getCsrfToken(COOKIE);
    const check = expect(p).rejects.toMatchObject({ status: 502 });
    await vi.advanceTimersByTimeAsync(500);
    await check;
    expect(fetchMock).toHaveBeenCalledTimes(2); // genau zwei, kein Dauerfeuer
  });

  it('ein 401 (tote Session) wird NICHT wiederholt – der Login soll sofort greifen', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ message: 'unauthorized' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCsrfToken(COOKIE)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ein 403 (tote Session) wird ebenfalls nicht wiederholt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ message: 'forbidden' }, 403));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCsrfToken(COOKIE)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
