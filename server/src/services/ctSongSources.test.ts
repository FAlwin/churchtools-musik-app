import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSongSources } from './ctSongSources.js';
import { __resetSessionMemosForTests, forgetSession } from './ctSessionMemos.js';

/**
 * Die Liedquellen (#396) – dritte Tabelle aus `getMasterData`, nach Kategorien und
 * Abwesenheitsgründen.
 *
 * **Die Vorlage ist eine echte Antwort** der Test-Instanz vom 20.09.2026
 * (`server/scripts/probe-arrangements-alt.ts`). Das ist hier keine Kosmetik, sondern der Grund für
 * die ganze Datei: `songsource` kommt als **Objekt**, nach ID geschlüsselt – während `songcategory`
 * am selben Endpunkt ein **Array** ist. Ein `?? []` mit anschließendem `map` hätte darauf nicht
 * geworfen, sondern still **nichts** geliefert: Die Gemeinde hätte im Formular keine Liederbücher
 * gesehen und niemand hätte einen Fehler bemerkt.
 */
const COOKIE = 'ChurchTools_sid=abc';

/** Genau so kam `songsource` aus `getMasterData` – als Objekt, alle Werte als Zeichenkette. */
const ECHT = {
  songsource: {
    '2': {
      id: '2',
      name: 'Unser Liederbuch',
      shorty: 'ULB',
      sortkey: '0',
      created_date: '2026-08-03 16:28:36',
    },
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockAjax(daten: unknown, status = 200): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
    const u = String(url);
    if (u.includes('/api/csrftoken')) return Promise.resolve(json({ data: 'token' }));
    if (u.includes('churchservice/ajax')) {
      if (status >= 400) return Promise.resolve(new Response('', { status }));
      return Promise.resolve(json({ status: 'success', data: daten }));
    }
    return Promise.resolve(new Response('', { status: 404 }));
  });
}

beforeEach(() => __resetSessionMemosForTests());
afterEach(() => vi.restoreAllMocks());

describe('getSongSources', () => {
  it('liest die echte Antwort – ein OBJEKT, nach ID geschlüsselt', async () => {
    mockAjax(ECHT);
    expect(await getSongSources(COOKIE)).toEqual([
      { id: 2, name: 'Unser Liederbuch', shorty: 'ULB' },
    ]);
  });

  it('liest auch die Array-Form – `songcategory` kommt am selben Endpunkt so', async () => {
    mockAjax({ songsource: [{ id: '5', name: 'Feiert Jesus', shorty: 'FJ', sortkey: '0' }] });
    expect(await getSongSources(COOKIE)).toEqual([{ id: 5, name: 'Feiert Jesus', shorty: 'FJ' }]);
  });

  it('macht aus der Zeichenketten-ID eine Zahl – sie wird später verglichen', async () => {
    mockAjax(ECHT);
    const [erste] = await getSongSources(COOKIE);
    expect(erste.id).toBe(2);
    expect(typeof erste.id).toBe('number');
  });

  it('sortiert nach `sortkey` – die Reihenfolge der Gemeinde, nicht die Einlesereihenfolge', async () => {
    mockAjax({
      songsource: {
        '9': { id: '9', name: 'Zweites Buch', shorty: 'ZB', sortkey: '10' },
        '2': { id: '2', name: 'Erstes Buch', shorty: 'EB', sortkey: '0' },
      },
    });
    expect((await getSongSources(COOKIE)).map((q) => q.name)).toEqual([
      'Erstes Buch',
      'Zweites Buch',
    ]);
  });

  it('lässt Einträge ohne Namen weg – sie wären im Formular ein leerer Knopf', async () => {
    mockAjax({ songsource: { '3': { id: '3', name: '  ', shorty: 'X' } } });
    expect(await getSongSources(COOKIE)).toEqual([]);
  });

  it('kommt ohne Kürzel aus – dann bleibt es leer, statt zu fehlen', async () => {
    mockAjax({ songsource: { '4': { id: '4', name: 'Ohne Kürzel' } } });
    expect(await getSongSources(COOKIE)).toEqual([{ id: 4, name: 'Ohne Kürzel', shorty: '' }]);
  });

  it('liefert eine leere Liste, wenn die Gemeinde keine Quellen führt', async () => {
    mockAjax({ songcategory: [] });
    expect(await getSongSources(COOKIE)).toEqual([]);
  });

  /**
   * **Kein stiller Rückfall** (anders als bei den Kategorien): Eine Quelle lässt sich aus den
   * Liedern nicht rekonstruieren – am Arrangement steht nur die ID. Wer hier eine leere Liste
   * zurückgäbe, behauptete „diese Gemeinde hat keine Liederbücher", obwohl nur die Schnittstelle
   * schweigt.
   */
  it('wirft, wenn die alte Schnittstelle nicht antwortet – statt „keine Quellen" zu behaupten', async () => {
    mockAjax(null, 503);
    await expect(getSongSources(COOKIE)).rejects.toThrow();
  });
});

/**
 * **Das Memo ist die Lehre der Schwesterstelle** (`absences.ts`, #177): Beide Listen kommen aus
 * derselben `getMasterData`-Antwort und hängen an einem Fenster, das ein Mensch öffnet. Ohne Memo
 * wäre jedes geöffnete Lied ein ChurchTools-Aufruf mehr – und genau solche Läufe haben die App
 * schon einmal in die Drosselung getrieben (#300).
 */
describe('getSongSources – das Kurzzeit-Memo', () => {
  /** Zählt die Aufrufe der alten Schnittstelle (das CSRF-Token zählt nicht mit). */
  function zaehlend(daten: unknown): () => number {
    let aufrufe = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const u = String(url);
      if (u.includes('/api/csrftoken')) return Promise.resolve(json({ data: 'token' }));
      aufrufe += 1;
      return Promise.resolve(json({ status: 'success', data: daten }));
    });
    return () => aufrufe;
  }

  it('fragt ChurchTools beim zweiten Mal NICHT erneut', async () => {
    const aufrufe = zaehlend(ECHT);
    await getSongSources(COOKIE);
    await getSongSources(COOKIE);
    expect(aufrufe()).toBe(1);
  });

  it('merkt sich eine LEERE Liste nicht – sie kann auch „noch nicht gesehen" heißen', async () => {
    const aufrufe = zaehlend({ songsource: {} });
    await getSongSources(COOKIE);
    await getSongSources(COOKIE);
    expect(aufrufe()).toBe(2);
  });

  it('vergisst beim Abmelden – sonst überlebt die Liste die Sitzung', async () => {
    const aufrufe = zaehlend(ECHT);
    await getSongSources(COOKIE);
    forgetSession(COOKIE);
    await getSongSources(COOKIE);
    expect(aufrufe()).toBe(2);
  });
});
