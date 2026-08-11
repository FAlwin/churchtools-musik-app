import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSongSelectSong, searchSongSelect } from './ctSongSelect.js';
import { __resetSessionMemosForTests } from './ctSessionMemos.js';

/**
 * #322: CCLI SongSelect über ChurchTools.
 *
 * **Die Vorlagen hier sind ECHTE Antworten** aus Alwins Messung vom 11.08.2026 (gekürzt auf die
 * Felder, die wir lesen). Erfundene Testdaten wären hier besonders wertlos: Die Form dieser Antwort
 * ist der ganze Grund, warum es diese Datei gibt – doppelt verpackt, `defaultKey` als Liste, und
 * `exists`/`isAuthorized` getrennt.
 *
 * Geprüft wird vor allem, was **nicht** passieren darf: etwas anbieten, das die Lizenz nicht
 * abdeckt, und Interna der Gemeinde nach außen geben.
 */
const COOKIE = 'ChurchTools_sid=abc';

/** Die doppelte Verpackung: außen ChurchTools, innen als Zeichenkette die Antwort von CCLI. */
function ctAntwort(innen: unknown, status = 200): Response {
  return new Response(JSON.stringify({ status: 'success', data: JSON.stringify(innen) }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Beantwortet das Token und lässt den eigentlichen Aufruf die Vorlage liefern. */
function mockCt(antwort: () => Response) {
  const gesendet: { url: string; body: string; csrf: boolean; xhr: boolean }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    const u = String(url);
    if (u.includes('/api/csrftoken')) {
      return Promise.resolve(
        new Response(JSON.stringify({ data: 'token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    const h = (init?.headers ?? {}) as Record<string, string>;
    gesendet.push({
      url: u,
      body: String(init?.body ?? ''),
      csrf: !!h['CSRF-Token'],
      xhr: h['X-Requested-With'] === 'XMLHttpRequest',
    });
    return Promise.resolve(antwort());
  });
  return gesendet;
}

/** Gekürzte, aber echte Trefferliste (drei Fälle, die sich unterscheiden). */
const SUCHE = {
  pagination: { pageSize: 100, pageNumber: 1, totalItems: 147, lastPage: 2 },
  data: {
    type: 'searchResults',
    results: [
      {
        title: 'Wo ich auch stehe',
        songNumber: 4330228,
        defaultKey: ['C'],
        authors: ['Albert Frey'],
        isPublicDomain: false,
        content: {
          lyrics: { exists: true, isAuthorized: true },
          chordSheet: { exists: true, isAuthorized: true },
          chordPro: { exists: true, isAuthorized: true },
        },
      },
      {
        // Echter Fall: Text ja, Akkorde nein – und KEINE Tonart hinterlegt.
        title: 'Wo ich auch geh',
        songNumber: 7037505,
        defaultKey: [],
        authors: ['Christusträger-Schwestern'],
        isPublicDomain: false,
        content: {
          lyrics: { exists: true, isAuthorized: true },
          chordSheet: { exists: false, isAuthorized: false },
          chordPro: { exists: false, isAuthorized: false },
        },
      },
      {
        /**
         * **Der entscheidende Fall:** Das Lied hat bei CCLI Akkorde, die Lizenz der Gemeinde deckt
         * sie aber NICHT ab. Ohne diesen Eintrag konnte der Lizenz-Test nichts messen – die
         * Gegenprobe (nur `exists` prüfen) blieb grün, weil in allen anderen Vorlagen `exists` und
         * `isAuthorized` denselben Wert haben. Genau das ist ein wertloser Test.
         */
        title: 'Nur Text lizenziert',
        songNumber: 1234567,
        defaultKey: ['G'],
        authors: ['Jemand'],
        isPublicDomain: false,
        content: {
          lyrics: { exists: true, isAuthorized: true },
          chordSheet: { exists: true, isAuthorized: false },
          chordPro: { exists: true, isAuthorized: false },
        },
      },
      {
        title: 'So nimm denn meine Hände',
        songNumber: 809097,
        defaultKey: ['D'],
        authors: ['Friedrich Silcher', 'Julie von Hausmann'],
        isPublicDomain: true,
        content: {
          lyrics: { exists: true, isAuthorized: true },
          chordSheet: { exists: true, isAuthorized: true },
          chordPro: { exists: true, isAuthorized: true },
        },
      },
    ],
  },
};

/** Echte Antwort auf die Abfrage per Nummer – hier kommt zusätzlich das Copyright mit. */
const ABFRAGE = {
  authorization: { organization: 'ECG-Donrath', accountId: '1261926', territoryId: 14 },
  data: {
    type: 'songDetail',
    id: '6d3e6ce3-35b5-4257-af8a-7143421fd40c',
    songNumber: 4328979,
    title: 'Treu',
    authors: ['Tobias Gerster'],
    copyrights: ['1995 Gerth Medien'],
    defaultKey: ['E'],
    isPublicDomain: false,
    content: {
      lyrics: { exists: true, isAuthorized: true },
      chordPro: { exists: true, isAuthorized: true },
      chordSheet: { exists: true, isAuthorized: true },
    },
    links: { self: 'https://api.ccli.com/ss/v2/songs/4328979' },
  },
};

beforeEach(() => __resetSessionMemosForTests());
afterEach(() => vi.restoreAllMocks());

describe('searchSongSelect – nach Titel suchen', () => {
  it('schickt func und Titel an die alte Schnittstelle, mit Token und XHR-Kopf', async () => {
    const g = mockCt(() => ctAntwort(SUCHE));
    await searchSongSelect(COOKIE, 'Wo ich auch stehe');

    expect(g).toHaveLength(1);
    expect(g[0].url).toContain('/index.php?q=churchservice/ajax');
    expect(g[0].body).toContain('func=getCCLISongsMatchingTitle');
    expect(g[0].body).toContain('songTitle=Wo+ich+auch+stehe');
    // Beides ist Pflicht: ohne Token lehnt ChurchTools ab, ohne XHR-Kopf kommt HTML statt JSON.
    expect(g[0].csrf).toBe(true);
    expect(g[0].xhr).toBe(true);
  });

  it('liest Titel, Autoren, Nummer und Tonart heraus', async () => {
    mockCt(() => ctAntwort(SUCHE));
    const { treffer } = await searchSongSelect(COOKIE, 'Wo');

    expect(treffer[0]).toEqual({
      songNumber: 4330228,
      title: 'Wo ich auch stehe',
      authors: ['Albert Frey'],
      defaultKey: 'C',
      isPublicDomain: false,
      hasLyrics: true,
      hasChordPro: true,
      hasChordSheet: true,
    });
  });

  it('macht aus einer LEEREN Tonart-Liste null, nicht einen leeren Text', async () => {
    // Gemessener Fall: „Wo ich auch geh" hat bei CCLI keine Tonart. `defaultKey: []` als `''` zu
    // lesen ergäbe eine Tonart, die es nicht gibt.
    mockCt(() => ctAntwort(SUCHE));
    const { treffer } = await searchSongSelect(COOKIE, 'Wo');
    expect(treffer[1].defaultKey).toBeNull();
  });

  it('bietet nichts an, was es bei CCLI gar nicht gibt', async () => {
    mockCt(() => ctAntwort(SUCHE));
    const { treffer } = await searchSongSelect(COOKIE, 'Wo');
    expect(treffer[1].hasLyrics).toBe(true);
    expect(treffer[1].hasChordPro).toBe(false);
  });

  it('bietet nichts an, was die LIZENZ nicht abdeckt – auch wenn es existiert', async () => {
    // Der wichtigste Test der Datei: `exists` allein genügt nicht. Ein Knopf für etwas, das CCLI
    // dann verweigert, führt ins Leere.
    mockCt(() => ctAntwort(SUCHE));
    const { treffer } = await searchSongSelect(COOKIE, 'Wo');
    const nurText = treffer.find((t) => t.songNumber === 1234567);
    expect(nurText?.hasLyrics).toBe(true);
    expect(nurText?.hasChordPro).toBe(false);
    expect(nurText?.hasChordSheet).toBe(false);
  });

  it('sagt, dass die Liste NICHT vollständig ist', async () => {
    // 147 Treffer, 100 geliefert – die Oberfläche muss zum Verfeinern raten dürfen, statt so zu
    // tun, als wäre das alles.
    mockCt(() => ctAntwort(SUCHE));
    const r = await searchSongSelect(COOKIE, 'Wo');
    expect(r.gesamt).toBe(147);
    expect(r.vollstaendig).toBe(false);
  });

  it('meldet eine vollständige Liste als vollständig', async () => {
    mockCt(() =>
      ctAntwort({ pagination: { totalItems: 4 }, data: { results: SUCHE.data.results } }),
    );
    const r = await searchSongSelect(COOKIE, 'Wo');
    expect(r.vollstaendig).toBe(true);
  });

  it('fragt bei leerem Titel gar nicht erst', async () => {
    const g = mockCt(() => ctAntwort(SUCHE));
    await expect(searchSongSelect(COOKIE, '   ')).rejects.toThrow(/Titel/);
    expect(g).toHaveLength(0);
  });
});

describe('getSongSelectSong – per CCLI-Nummer', () => {
  it('liefert das Copyright mit – das braucht das Anlegen-Formular', async () => {
    mockCt(() => ctAntwort(ABFRAGE));
    const s = await getSongSelectSong(COOKIE, 4328979);

    expect(s.title).toBe('Treu');
    expect(s.authors).toEqual(['Tobias Gerster']);
    expect(s.defaultKey).toBe('E');
    expect(s.copyright).toBe('1995 Gerth Medien');
  });

  it('gibt KEINE Interna der Gemeinde nach außen', async () => {
    // Die Antwort von CCLI enthält Konto-Nummer, interne IDs und API-Links. Nichts davon gehört in
    // den Browser – geprüft am ganzen Ergebnis, nicht Feld für Feld, damit auch später nichts
    // durchrutscht.
    mockCt(() => ctAntwort(ABFRAGE));
    const s = await getSongSelectSong(COOKIE, 4328979);

    const alsText = JSON.stringify(s);
    expect(alsText).not.toContain('1261926');
    expect(alsText).not.toContain('api.ccli.com');
    expect(alsText).not.toContain('6d3e6ce3');
    expect(Object.keys(s).sort()).toEqual([
      'authors',
      'copyright',
      'defaultKey',
      'hasChordPro',
      'hasChordSheet',
      'hasLyrics',
      'isPublicDomain',
      'songNumber',
      'title',
    ]);
  });

  it('meldet eine unbekannte Nummer als 404, nicht als leeres Lied', async () => {
    mockCt(() => ctAntwort({ data: null }));
    await expect(getSongSelectSong(COOKIE, 999)).rejects.toThrow(/999/);
  });
});

describe('Fehler werden benannt, nicht verschluckt', () => {
  it('eine Antwort ohne „success" gibt die Meldung von ChurchTools weiter', async () => {
    mockCt(
      () =>
        new Response(JSON.stringify({ status: 'error', message: 'CCLI nicht aktiviert.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    await expect(searchSongSelect(COOKIE, 'Treu')).rejects.toThrow(/CCLI nicht aktiviert/);
  });

  it('HTML statt JSON (abgelaufene Sitzung) wird als solches gemeldet', async () => {
    // Genau das passiert bei der alten Schnittstelle, wenn die Sitzung weg ist: eine Anmeldeseite.
    mockCt(() => new Response('<!DOCTYPE html><html>…', { status: 200 }));
    await expect(searchSongSelect(COOKIE, 'Treu')).rejects.toThrow(/keine lesbare Antwort/);
  });

  it('ein Fehlschlag von ChurchTools nennt den Statuscode', async () => {
    mockCt(() => new Response('', { status: 503 }));
    await expect(searchSongSelect(COOKIE, 'Treu')).rejects.toThrow(/503/);
  });
});
