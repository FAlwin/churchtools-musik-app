import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  __getCsrfTokenForTests as getCsrfToken,
  __resetCsrfCacheForTests,
  deleteFile,
} from './churchtools.js';

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

// Seit #298 wird das Token zwischengespeichert – ohne Reset würde jeder Test ab dem zweiten aus dem
// Cache des vorigen bedient und bewiese nichts (die 5 vorhandenen Tests fielen prompt genau darum).
beforeEach(() => __resetCsrfCacheForTests());

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

/**
 * #298: Das Token wird zwischengespeichert, damit nicht JEDE Schreibaktion einen zusätzlichen
 * ChurchTools-Aufruf kostet.
 *
 * Hintergrund: Beim Testen zu mehreren trat reproduzierbar „CSRF-Token konnte nicht geholt werden" auf,
 * während alle anderen Endpunkte mit demselben Cookie funktionierten – das Bild einer Drosselung genau
 * dieses Endpunkts. Bewiesen ist sie nicht (der Statuscode wurde nie gesehen); der Cache senkt die
 * Anfragen aber unabhängig davon.
 *
 * Der Cache bringt eine NEUE Gefahr mit, die hier ausdrücklich geprüft wird: Ein einmal abgelehntes
 * Token darf nicht endlos weiterverwendet werden – sonst hätte er eine dauerhafte Sackgasse gebaut.
 */
describe('CSRF-Token wird zwischengespeichert (#298)', () => {
  it('der zweite Schreibvorgang holt KEIN neues Token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ data: 'token-A' }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await getCsrfToken(COOKIE)).toBe('token-A');
    expect(await getCsrfToken(COOKIE)).toBe('token-A');
    expect(await getCsrfToken(COOKIE)).toBe('token-A');
    expect(fetchMock).toHaveBeenCalledTimes(1); // ← der eigentliche Zweck
  });

  it('nach Ablauf der Gültigkeit wird wieder frisch geholt', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ data: 'token-alt' }))
      .mockResolvedValueOnce(jsonRes({ data: 'token-neu' }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await getCsrfToken(COOKIE)).toBe('token-alt');
    await vi.advanceTimersByTimeAsync(61_000); // TTL (60 s) überschritten
    expect(await getCsrfToken(COOKIE)).toBe('token-neu');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('verschiedene Sitzungen bekommen verschiedene Token (kein Vermischen)', async () => {
    // Sicherheitsrelevant: Der Cache ist je Cookie – niemals darf ein Konto das Token eines anderen
    // benutzen.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ data: 'token-anna' }))
      .mockResolvedValueOnce(jsonRes({ data: 'token-bert' }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await getCsrfToken('ChurchTools_sid=anna')).toBe('token-anna');
    expect(await getCsrfToken('ChurchTools_sid=bert')).toBe('token-bert');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('parallele Schreibvorgänge lösen NUR EINEN Abruf aus', async () => {
    // Umsortieren per Ziehen feuert mehrere Schreibvorgänge fast gleichzeitig – ohne Bündelung wären
    // das mehrere Token-Abrufe auf einmal, also genau die Last, die wir vermeiden wollen.
    let freigeben: (v: Response) => void = () => {};
    const antwort = new Promise<Response>((r) => {
      freigeben = r;
    });
    const fetchMock = vi.fn().mockReturnValue(antwort);
    vi.stubGlobal('fetch', fetchMock);

    const beide = Promise.all([getCsrfToken(COOKIE), getCsrfToken(COOKIE)]);
    freigeben(jsonRes({ data: 'token-geteilt' }));

    expect(await beide).toEqual(['token-geteilt', 'token-geteilt']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ein FEHLGESCHLAGENER Abruf wird nicht zwischengespeichert', async () => {
    // Sonst würde ein einzelner Fehlschlag eine Minute lang jeden Speichervorgang blockieren.
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ message: 'unauthorized' }, 401)) // kein Retry, kein Cache
      .mockResolvedValueOnce(jsonRes({ data: 'token-danach' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCsrfToken(COOKIE)).rejects.toMatchObject({ status: 401 });
    expect(await getCsrfToken(COOKIE)).toBe('token-danach'); // frischer Versuch, nicht aus dem Cache
  });

  it('nach einem Fehlschlag ist die Bündelung wieder frei (kein hängender Eintrag)', async () => {
    // Wäre der „läuft gerade"-Eintrag nach einem Fehler nicht aufgeräumt, bekäme jeder weitere
    // Schreibvorgang für immer dasselbe abgelehnte Promise zurück.
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ message: 'unauthorized' }, 401))
      .mockResolvedValueOnce(jsonRes({ data: 'token-frei' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCsrfToken(COOKIE)).rejects.toBeTruthy();
    await expect(getCsrfToken(COOKIE)).resolves.toBe('token-frei');
  });
});

/**
 * #298 – die GEFAHR, die der Cache mitbringt: ein abgelehntes Token darf nicht kleben bleiben.
 *
 * Lehnt ChurchTools einen Schreibvorgang mit 401/403 ab, kann das auch heißen „dieses Token akzeptiere
 * ich nicht mehr". Bliebe es im Cache, bekäme der Nutzer bis zum Ablauf der Gültigkeit bei JEDEM
 * Versuch dieselbe Ablehnung – eine dauerhafte Sackgasse, die es vor dem Cache nicht gab. Deshalb
 * verwirft `csrfWriteDenied` den Eintrag.
 *
 * Geprüft am echten Schreibpfad (`deleteFile`), nicht an der Hilfsfunktion – es war ja gerade die
 * VERDRAHTUNG an sieben Stellen, die schiefgehen konnte.
 */
describe('abgelehnter Schreibvorgang verwirft das Token (#298)', () => {
  /** Router-Mock: /api/csrftoken liefert Token, alles andere ist der Schreibvorgang. */
  function mockFetch(schreibStatus: number, token = 'token-1'): ReturnType<typeof vi.fn> {
    return vi.fn((url: string) =>
      Promise.resolve(
        String(url).includes('/api/csrftoken')
          ? jsonRes({ data: token })
          : jsonRes({ message: 'nope' }, schreibStatus),
      ),
    );
  }

  it('nach einem 403 holt der nächste Versuch ein FRISCHES Token', async () => {
    const fetchMock = mockFetch(403);
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteFile(COOKIE, 1)).rejects.toMatchObject({ status: 403 });
    await expect(deleteFile(COOKIE, 1)).rejects.toMatchObject({ status: 403 });

    // Zwei Schreibversuche → ZWEI Token-Abrufe. Ohne Invalidierung wäre es nur einer geblieben und
    // der Nutzer hätte eine Minute lang keine Chance gehabt.
    const tokenAbrufe = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes('/api/csrftoken'),
    ).length;
    expect(tokenAbrufe).toBe(2);
  });

  it('ein 401 verwirft es ebenfalls', async () => {
    const fetchMock = mockFetch(401);
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteFile(COOKIE, 1)).rejects.toMatchObject({ status: 403 });
    await expect(deleteFile(COOKIE, 1)).rejects.toMatchObject({ status: 403 });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/csrftoken')).length).toBe(
      2,
    );
  });

  it('bei ERFOLG bleibt das Token liegen (sonst wäre der Cache wirkungslos)', async () => {
    const fetchMock = mockFetch(200);
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteFile(COOKIE, 1)).resolves.toBeUndefined();
    await expect(deleteFile(COOKIE, 2)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/csrftoken')).length).toBe(
      1,
    );
  });

  it('ein anderer Fehler (502) verwirft das Token NICHT – es war nicht das Token', async () => {
    // Wichtige Abgrenzung: Ein Serverfehler beim Schreiben sagt nichts über das Token aus.
    const fetchMock = mockFetch(500);
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteFile(COOKIE, 1)).rejects.toMatchObject({ status: 502 });
    await expect(deleteFile(COOKIE, 1)).rejects.toMatchObject({ status: 502 });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/csrftoken')).length).toBe(
      1,
    );
  });
});
