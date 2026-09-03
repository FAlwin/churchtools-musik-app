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
const { whoami, login, extractSessionCookie } = await import('./ctAuth.js');

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
function antwort(status: number, ...cookies: string[]): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'retry-after' ? '30' : null),
      getSetCookie: () => cookies,
    },
  } as unknown as Response;
}

/**
 * Die drei `Set-Cookie`-Zeilen, mit denen ChurchTools 3.136.2 auf eine Anmeldung antwortet –
 * gemessen am 03.09.2026. Die Werte sind erfunden (ein echter Sitzungsschlüssel gehört in keine
 * Testdatei), die **Formen** sind es nicht: zwei Lösch-Cookies der alten Fassung, dann das gültige
 * der neuen.
 */
const ALT_GELOESCHT =
  'ChurchTools_ct_gemeinde=; expires=Thu, 01-Jan-1970 00:00:01 GMT; Max-Age=0; path=/; HttpOnly; SameSite=None; secure';
const ALT_GELOESCHT_PARTITIONED = `${ALT_GELOESCHT}; Partitioned`;
const V2_GUELTIG =
  'ChurchToolsV2_ct_gemeinde=beispielwert123; expires=Fri, 04-Sep-2026 20:16:05 GMT; Max-Age=86399; path=/; HttpOnly; SameSite=None; secure';

describe('extractSessionCookie – die Fassungsnummer im Cookie-Namen (#381)', () => {
  it('nimmt aus der GEMESSENEN Antwort das gültige V2-Cookie', () => {
    // Der eigentliche Fehler: Der frühere Ausdruck fand hier NICHTS – beim neuen Namen steht hinter
    // `ChurchTools` ein `V2` statt `_`, und die alten tragen keinen Wert mehr. Folge war
    // „Keine Session von ChurchTools erhalten." (502), und zwar ohne Logzeile.
    const res = antwort(200, ALT_GELOESCHT, ALT_GELOESCHT_PARTITIONED, V2_GUELTIG);
    expect(extractSessionCookie(res)).toBe('ChurchToolsV2_ct_gemeinde=beispielwert123');
  });

  it('die alte Form allein funktioniert weiter', () => {
    // Rückwärtsrichtung: Eine ChurchTools-Instanz, die noch nicht aktualisiert ist, darf nicht
    // ausfallen. Es gibt viele – die App wird auch von anderen Gemeinden betrieben.
    const res = antwort(200, 'ChurchTools_ct_gemeinde=altwert456; path=/; HttpOnly');
    expect(extractSessionCookie(res)).toBe('ChurchTools_ct_gemeinde=altwert456');
  });

  it('tragen BEIDE einen Wert, gewinnt die höhere Fassung', () => {
    // Übergangsfall. „Nimm das erste" hätte hier das alte genommen – und wäre mit einer entwerteten
    // Sitzung weitergelaufen, also wieder bei „Anonymous" gelandet.
    const res = antwort(
      200,
      'ChurchTools_ct_gemeinde=altwert456; path=/',
      'ChurchToolsV2_ct_gemeinde=neuwert789; path=/',
    );
    expect(extractSessionCookie(res)).toBe('ChurchToolsV2_ct_gemeinde=neuwert789');
  });

  it('eine künftige Fassung V3 gewinnt gegen V2 – ohne Änderung hier', () => {
    // Der Punkt der ganzen Umstellung: Dass ChurchTools den Namen ohne Ankündigung erhöht hat, heißt,
    // es kann wieder passieren. Diese Stelle trägt das dann von selbst.
    const res = antwort(
      200,
      'ChurchToolsV2_ct_gemeinde=zwei; path=/',
      'ChurchToolsV3_ct_gemeinde=drei; path=/',
    );
    expect(extractSessionCookie(res)).toBe('ChurchToolsV3_ct_gemeinde=drei');
  });

  it('nur Lösch-Cookies ergeben KEINE Sitzung', () => {
    // Ein Cookie mit leerem Wert ist keine Anmeldung – sonst liefe die App mit einem Cookie los,
    // das ChurchTools gerade verworfen hat.
    const res = antwort(200, ALT_GELOESCHT, ALT_GELOESCHT_PARTITIONED);
    expect(extractSessionCookie(res)).toBeNull();
  });

  it('fremde Cookies werden ignoriert', () => {
    const res = antwort(200, 'anderes=xyz; path=/', 'PHPSESSID=abc; path=/');
    expect(extractSessionCookie(res)).toBeNull();
  });
});

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

  it('mit gültigem V2-Cookie geht es weiter zu whoami', async () => {
    // Belegt, dass Cookie-Fund und whoami-Prüfung zusammenspielen: Das Cookie wird gefunden (kein
    // 502 wegen „keine Session"), und der Phantom-Nutzer dahinter wird erkannt.
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(antwort(200, V2_GUELTIG)));
    vi.mocked(ctGet).mockResolvedValue({ id: -1, firstName: '', lastName: 'Anonymous' });

    await expect(login('a@b.de', 'geheim')).rejects.toMatchObject({ status: 502 });
    expect(ctGet).toHaveBeenCalledWith('ChurchToolsV2_ct_gemeinde=beispielwert123', '/api/whoami');
    log.mockRestore();
  });

  it('ein 401 aus whoami wird im Anmeldeformular NICHT zu „neu anmelden"', async () => {
    // Die Meldung muss im Login-Kontext stimmen: „Session abgelaufen. Bitte neu anmelden." wäre hier
    // eine Aufforderung im Kreis (#218). Also 502 -> „am Passwort liegt es nicht", plus Logzeile.
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(antwort(200, V2_GUELTIG)));
    vi.mocked(ctGet).mockResolvedValue({ id: -1, lastName: 'Anonymous', firstName: '' });

    await expect(login('a@b.de', 'geheim')).rejects.not.toMatchObject({ status: 401 });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('whoami erkennt es nicht an'));
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
