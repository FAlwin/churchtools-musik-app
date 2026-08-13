import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { liedAnlegen } from './songErstellen.js';
import { __resetSessionMemosForTests } from './ctSessionMemos.js';

/**
 * #322, Schritt 10: ein Lied anlegen.
 *
 * **Geprüft wird vor allem, was NICHT passieren darf.** Ein Lied entsteht in zwei bis drei
 * Schreibvorgängen ohne Transaktion; die gefährlichen Fälle sind nicht die glatten Durchläufe,
 * sondern die halben:
 *  - das Lied ist da, das Arrangement nicht → der Nutzer MUSS das erfahren, sonst legt sein zweiter
 *    Versuch ein zweites Lied an,
 *  - der Ablauf-Eintrag scheitert → das ist KEIN Gesamtfehler, das Lied existiert,
 *  - dieselbe CCLI-Nummer ist schon vergeben → blockieren, auch wenn das vorhandene Lied gar kein
 *    Arrangement hat (genau der Rest eines halb gescheiterten Versuchs).
 *
 * Die Antwortformen stammen aus der Messung an der Test-Instanz (13.08.2026, `probe-songwrite.ts`).
 */
const COOKIE = 'ChurchTools_sid=abc';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Rechte-Antwort: darf in Kategorie 0 und 1 anlegen. */
const RECHTE = { churchservice: { 'edit songcategory': [0, 1], 'view songcategory': [0, 1] } };

/** Kategorien über die alte Schnittstelle. */
const MASTERDATA = {
  songcategory: [
    { id: '0', bezeichnung: 'Aktive Songs', sortkey: '0' },
    { id: '1', bezeichnung: 'Inaktive Songs', sortkey: '10' },
  ],
};

interface MockOpts {
  /** Vorhandene Lieder (für die Doppel-Erkennung). */
  lieder?: { id: number; name: string; ccli?: string | null; arrangements?: unknown[] }[];
  /** Rechte-Antwort; Standard: darf in 0 und 1. */
  rechte?: unknown;
  /** Status für POST /api/songs (Standard 201). */
  songStatus?: number;
  /** Status für POST …/arrangements (Standard 201). */
  arrStatus?: number;
  /** Status für POST …/agenda/items (Standard 201). */
  agendaStatus?: number;
  /** Soll der abschließende GET das Arrangement zeigen? (Standard ja) */
  arrangementSichtbar?: boolean;
  /** Antwortet der Anlege-POST mit 201, aber OHNE `data.id`? */
  songOhneId?: boolean;
}

/**
 * Alle Wege, die `liedAnlegen` berührt – nach URL und Methode unterschieden.
 *
 * Gibt neben den Aufrufen auch die **gesendeten Rümpfe** zurück. Das ist nötig, weil zwei
 * Behauptungen nicht am Ergebnis ablesbar sind, sondern nur daran, was ChurchTools bekommt –
 * etwa `isDefault`, ohne das ein Lied kein Standard-Arrangement hätte.
 */
function mockCt(opts: MockOpts = {}): { aufrufe: string[]; ruempfe: Map<string, string> } {
  const aufrufe: string[] = [];
  const ruempfe = new Map<string, string>();
  const neueSongId = 42;
  const neueArrId = 99;

  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    const u = String(url);
    const m = String(init?.method ?? 'GET');
    const pfad = u.replace(/^https?:\/\/[^/]+/, '');
    aufrufe.push(`${m} ${pfad}`);
    if (init?.body !== undefined) ruempfe.set(`${m} ${pfad}`, String(init.body));

    if (u.includes('/api/csrftoken')) return Promise.resolve(json({ data: 'token' }));
    if (u.includes('/api/permissions/global')) {
      return Promise.resolve(json({ data: opts.rechte ?? RECHTE }));
    }
    if (u.includes('churchservice/ajax')) {
      return Promise.resolve(json({ status: 'success', data: MASTERDATA }));
    }
    if (m === 'POST' && /\/api\/songs$/.test(u)) {
      const st = opts.songStatus ?? 201;
      if (st >= 400) return Promise.resolve(new Response('', { status: st }));
      // Erfolg gemeldet, aber ohne ID – genau die Sorte Antwort, die am 11.08.2026 teuer war.
      return Promise.resolve(
        opts.songOhneId ? json({ status: 'success' }, st) : json({ data: { id: neueSongId } }, st),
      );
    }
    if (m === 'POST' && /\/arrangements$/.test(u)) {
      const st = opts.arrStatus ?? 201;
      return Promise.resolve(
        st >= 400 ? new Response('', { status: st }) : json({ data: { id: neueArrId } }, st),
      );
    }
    if (m === 'POST' && /\/agenda\/items$/.test(u)) {
      const st = opts.agendaStatus ?? 201;
      return Promise.resolve(
        st >= 400 ? new Response('', { status: st }) : json({ data: { id: 7 } }, st),
      );
    }
    // GET auf das frisch angelegte Lied – die Kontrolle „nachsehen statt glauben".
    if (m === 'GET' && new RegExp(`/api/songs/${neueSongId}$`).test(u)) {
      return Promise.resolve(
        json({
          data: {
            id: neueSongId,
            name: 'Neues Lied',
            arrangements:
              opts.arrangementSichtbar === false ? [] : [{ id: neueArrId, name: 'Standard' }],
          },
        }),
      );
    }
    // Die Liedliste für die Doppel-Erkennung.
    if (m === 'GET' && u.includes('/api/songs?')) {
      return Promise.resolve(json({ data: opts.lieder ?? [] }));
    }
    throw new Error(`unerwarteter Aufruf: ${m} ${u}`);
  });
  return { aufrufe, ruempfe };
}

const AUFTRAG = { name: 'Neues Lied', categoryId: 0, ccli: '7654321', key: 'E' };

beforeEach(() => {
  __resetSessionMemosForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('der glatte Durchlauf', () => {
  it('legt Lied und Arrangement an und gibt beide IDs zurück', async () => {
    const { aufrufe } = mockCt();
    expect(await liedAnlegen(COOKIE, AUFTRAG)).toEqual({ songId: 42, arrangementId: 99 });
    // Und sieht danach nach, statt dem 201 zu glauben.
    expect(aufrufe).toContain('GET /api/songs/42');
  });

  it('schickt `isDefault` mit – ohne das Flag hätte das Lied kein Standard-Arrangement', async () => {
    const { ruempfe } = mockCt();
    await liedAnlegen(COOKIE, AUFTRAG);
    const gesendet = ruempfe.get('POST /api/songs/42/arrangements') ?? '';
    expect(gesendet).toContain('"isDefault":true');
    expect(gesendet).toContain('"key":"E"');
  });

  it('sendet Autor, CCLI und Copyright gleich beim Anlegen – kein zweiter Schreibvorgang', async () => {
    // Gemessen: `POST /api/songs` nimmt diese drei an (nur `note` nicht, siehe `createSong`).
    const { ruempfe, aufrufe } = mockCt();
    await liedAnlegen(COOKIE, { ...AUFTRAG, author: 'Autor', copyright: '© 2026' });
    const gesendet = ruempfe.get('POST /api/songs') ?? '';
    expect(gesendet).toContain('"author":"Autor"');
    expect(gesendet).toContain('"ccli":"7654321"');
    expect(gesendet).toContain('"copyright":"© 2026"');
    // Und wirklich nur EIN Schreibvorgang für das Lied selbst.
    expect(aufrufe.filter((a) => a === 'PUT /api/songs/42')).toHaveLength(0);
  });

  it('trägt das Lied in den Ablauf ein, wenn ein Termin mitkommt', async () => {
    mockCt();
    expect(await liedAnlegen(COOKIE, { ...AUFTRAG, eventId: 5 })).toEqual({
      songId: 42,
      arrangementId: 99,
      imAblauf: true,
    });
  });
});

describe('Rechte und Doppel – beides serverseitig, nicht nur im Formular', () => {
  it('lehnt eine Kategorie ab, die das Recht nicht nennt', async () => {
    mockCt({ rechte: { churchservice: { 'edit songcategory': [1] } } });
    await expect(liedAnlegen(COOKIE, AUFTRAG)).rejects.toThrow(/keine Lieder anlegen/);
  });

  it('blockiert eine schon vergebene CCLI-Nummer und nennt das vorhandene Lied', async () => {
    mockCt({ lieder: [{ id: 7, name: 'Treu', ccli: '7654321' }] });
    await expect(liedAnlegen(COOKIE, AUFTRAG)).rejects.toThrow(/Treu/);
  });

  /**
   * **Der Fall, für den die Blockade am nötigsten ist.** Ein Lied ohne Arrangement ist der Rest
   * eines halb gescheiterten Versuchs. Setzte die Prüfung auf `getSongLibrary` auf (die solche
   * Lieder wegwirft), wäre sie ausgerechnet hier blind – und der zweite Versuch legte ein Doppel an.
   */
  it('findet auch ein Lied OHNE Arrangement', async () => {
    mockCt({ lieder: [{ id: 7, name: 'Halb angelegt', ccli: '7654321', arrangements: [] }] });
    await expect(liedAnlegen(COOKIE, AUFTRAG)).rejects.toThrow(/Halb angelegt/);
  });

  it('vergleicht die Nummer als Text, nicht als Zahl', async () => {
    // Führende Null: als Zahl gelesen wären "0123" und "123" dasselbe – sind sie aber nicht.
    mockCt({ lieder: [{ id: 7, name: 'Anderes', ccli: '0123' }] });
    await expect(liedAnlegen(COOKIE, { ...AUFTRAG, ccli: '123' })).resolves.toMatchObject({
      songId: 42,
    });
  });

  it('ohne CCLI-Nummer wird nicht blockiert', async () => {
    mockCt({ lieder: [{ id: 7, name: 'Ohne Nummer', ccli: null }] });
    const { ccli, ...ohneNummer } = AUFTRAG;
    void ccli;
    await expect(liedAnlegen(COOKIE, ohneNummer)).resolves.toMatchObject({ songId: 42 });
  });
});

describe('halbe Durchläufe werden benannt, nicht verschluckt', () => {
  /**
   * Der wichtigste Test der Datei: Scheitert das Arrangement, liegt in ChurchTools ein Lied. Sagt die
   * App nur „fehlgeschlagen", drückt der Nutzer noch einmal – und hat es zweimal.
   */
  it('sagt es deutlich, wenn das Lied da ist, das Arrangement aber nicht', async () => {
    mockCt({ arrStatus: 502 });
    await expect(liedAnlegen(COOKIE, AUFTRAG)).rejects.toThrow(
      /wurde in ChurchTools angelegt, aber ohne Arrangement/,
    );
    // Und warnt ausdrücklich vor dem zweiten Versuch.
    await expect(liedAnlegen(COOKIE, AUFTRAG)).rejects.toThrow(/doppelt anlegen/);
  });

  it('meldet es, wenn ChurchTools das Arrangement hinterher nicht zeigt', async () => {
    mockCt({ arrangementSichtbar: false });
    await expect(liedAnlegen(COOKIE, AUFTRAG)).rejects.toThrow(/zeigt das Arrangement nicht/);
  });

  /**
   * Ein gescheiterter Ablauf-Eintrag ist **kein** Gesamtfehler – das Lied existiert mitsamt
   * Arrangement. Ein Wurf hier hieße: „nichts passiert", und das wäre gelogen.
   */
  it('ein misslungener Ablauf-Eintrag macht das Anlegen nicht zunichte', async () => {
    mockCt({ agendaStatus: 502 });
    const ergebnis = await liedAnlegen(COOKIE, { ...AUFTRAG, eventId: 5 });
    expect(ergebnis.songId).toBe(42);
    expect(ergebnis.imAblauf).toBe(false);
    expect(ergebnis.ablaufFehler).toMatch(/Ablaufpunkt anlegen fehlgeschlagen/);
  });

  it('wirft, wenn ChurchTools keine ID nennt – ein 201 allein ist kein Beleg', async () => {
    mockCt({ songOhneId: true });
    await expect(liedAnlegen(COOKIE, AUFTRAG)).rejects.toThrow(/nannte keine ID/);
  });
});
