import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CtOverloadedError } from './ctHttp.js';

/**
 * #381: Eine tote ChurchTools-Session muss als 401 erkannt werden.
 *
 * ChurchTools antwortet auf `/api/whoami` **ohne gültige Session nicht mit 401**, sondern mit
 * **HTTP 200** und einem Phantom-Nutzer `{"id":-1,"lastName":"Anonymous"}` (gemessen an 3.136.2,
 * Build 32882, am 03.09.2026). Der ganze Ausgesperrt-Schutz der App hängt aber an diesem 401:
 * `getMe` verwirft die Session nur dann (#270), `getCapabilities` führt nur dann zum Login statt in
 * die „Erneut versuchen"-Sackgasse (#149, Bezug #104).
 *
 * Die Tests decken beide Phantom-Formen ab, die real vorkommen können, und die Gegenrichtung: Eine
 * echte Anmeldung darf NICHT abgelehnt werden – sonst tauscht der Fix eine Sackgasse gegen eine
 * andere.
 */
vi.mock('./ctHttp.js', async () => {
  const echt = await vi.importActual<typeof import('./ctHttp.js')>('./ctHttp.js');
  return { ...echt, BASE: 'https://ct.example', ctGet: vi.fn() };
});

const { ctGet } = await import('./ctHttp.js');
const { whoami, login } = await import('./ctAuth.js');

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('whoami – Phantom-Nutzer ist keine Anmeldung (#381)', () => {
  it('id -1 („Anonymous") wird zu 401', async () => {
    // Genau die gemessene Antwort von ChurchTools 3.136.2 bei toter Session.
    vi.mocked(ctGet).mockResolvedValue({ id: -1, firstName: '', lastName: 'Anonymous' });
    await expect(whoami('ChurchTools_sid=tot')).rejects.toMatchObject({ status: 401 });
  });

  it('id 0 wird zu 401', async () => {
    // Es gibt keine Person 0. Bei Lied-Kategorien ist 0 gültig („Aktive Songs"), bei Personen nicht –
    // deshalb prüft diese Stelle `> 0` und nicht bloß „ist eine Zahl".
    vi.mocked(ctGet).mockResolvedValue({ id: 0, firstName: '', lastName: '' });
    await expect(whoami('ChurchTools_sid=tot')).rejects.toMatchObject({ status: 401 });
  });

  it('fehlende id wird zu 401', async () => {
    // `ctGet<T>` behauptet den Typ nur (castet) – eine Antwort ohne `id` ist möglich.
    vi.mocked(ctGet).mockResolvedValue({ firstName: 'Ohne', lastName: 'Id' });
    await expect(whoami('ChurchTools_sid=tot')).rejects.toMatchObject({ status: 401 });
  });

  it('echte Anmeldung geht durch – auch mit ID als Zeichenkette', async () => {
    // Die Gegenrichtung: Der Fix darf keine gültige Anmeldung abweisen. Die alten
    // ChurchTools-Schnittstellen liefern IDs als Text – deshalb liest `ctId` beide Formen.
    vi.mocked(ctGet).mockResolvedValue({ id: '42', firstName: 'Anna', lastName: 'Beispiel' });
    await expect(whoami('ChurchTools_sid=gut')).resolves.toEqual({
      id: 42,
      firstName: 'Anna',
      lastName: 'Beispiel',
    });
  });
});

/** Antwort-Attrappe für `fetch` – nur die Felder, die `login` liest. */
function antwort(status: number, cookie?: string): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'retry-after' ? '30' : null),
      getSetCookie: () => (cookie ? [cookie] : []),
    },
  } as unknown as Response;
}

describe('login – die stummen Fehlschläge sind jetzt im Log (#381)', () => {
  it('429 wird als Drosselung gemeldet, nicht als Serverfehler', async () => {
    // Die VIERTE Stelle dieser Regel: `ctGet` (#300), Datei-Download und `ctWrite` unterscheiden
    // 429 längst – der Anmeldepfad machte daraus einen 502 („am Passwort liegt es nicht") statt
    // „ChurchTools bremst uns gerade aus".
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(antwort(429)));
    await expect(login('a@b.de', 'geheim')).rejects.toBeInstanceOf(CtOverloadedError);
  });

  it('unerwarteter Status wird geloggt und nennt den echten Statuscode', async () => {
    // Dieser Zweig war stumm: Der `errorHandler` loggt nur nicht-`HttpError`, ein Request-Log gibt
    // es nicht. Ein fehlgeschlagener Login hinterließ damit KEINE Spur im Container-Log – genau
    // daran scheiterte die Aufklärung des Vorfalls vom 03.09.2026.
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(antwort(503)));

    await expect(login('a@b.de', 'geheim')).rejects.toMatchObject({ status: 502 });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('503'));
    log.mockRestore();
  });

  it('200 ohne ChurchTools-Cookie wird geloggt', async () => {
    // Ebenfalls stumm gewesen – und von einem echten Serverfehler nicht zu unterscheiden.
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(antwort(200)));

    await expect(login('a@b.de', 'geheim')).rejects.toMatchObject({ status: 502 });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('kein ChurchTools_*-Cookie'));
    log.mockRestore();
  });

  it('falsche Zugangsdaten bleiben ein 401 – und werden NICHT geloggt', async () => {
    // Der häufigste Fall darf das Log nicht fluten (dieselbe Überlegung wie #215 für 404).
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(antwort(400)));

    await expect(login('a@b.de', 'falsch')).rejects.toMatchObject({ status: 401 });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
