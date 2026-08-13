import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEditableSongCategories, getSongCategories } from './ctSongCategories.js';
import { parseCapabilities, parseSongEditRight } from './ctCapabilities.js';
import { __resetSessionMemosForTests } from './ctSessionMemos.js';

/**
 * #322, Schritt 7: Lied-Kategorien und das Recht darauf.
 *
 * **Die Vorlagen sind echte Antworten** aus der Messung vom 13.08.2026 (ChurchTools 3.135.2, Skript
 * `server/scripts/probe-songmgmt.ts`). Das ist hier nicht Kosmetik: Die ganze Datei existiert wegen
 * zweier Eigenheiten, die man sich nicht ausdenkt – die alte Schnittstelle liefert `id` als
 * **Zeichenkette** und nennt den Namen `bezeichnung`, und das Recht kommt als **Liste von IDs**.
 */
const COOKIE = 'ChurchTools_sid=abc';

/** Genau so kam `songcategory` aus `getMasterData` – Reihenfolge absichtlich verdreht. */
const MASTERDATA = {
  songcategory: [
    { id: '1', bezeichnung: 'Inaktive Songs', sortkey: '10', station_id: null },
    { id: '0', bezeichnung: 'Aktive Songs', sortkey: '0', station_id: null },
  ],
};

/** Ein Lied der Liedliste, gekürzt auf die Felder, die wir lesen. */
function lied(id: number, name: string, kategorie?: { id: number; name: string }) {
  return {
    id,
    name,
    author: null,
    ccli: '5841527',
    category: kategorie,
    arrangements: [{ id: id * 10, name: 'Standard', key: 'E', keyOfArrangement: 'E' }],
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Beantwortet die vier Wege, die hier zusammenkommen: CSRF-Token, die alte Schnittstelle, die
 * Rechte und die Liedliste. `ajax` darf `null` sein – dann scheitert die alte Schnittstelle, und
 * genau das prüft der Rückfall.
 */
function mockCt(opts: { ajax?: unknown; rechte?: unknown; lieder?: unknown[] }): {
  ajaxAufrufe: string[];
} {
  const ajaxAufrufe: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    const u = String(url);
    if (u.includes('/api/csrftoken')) return Promise.resolve(json({ data: 'token' }));
    if (u.includes('churchservice/ajax')) {
      ajaxAufrufe.push(String(init?.body ?? ''));
      if (opts.ajax === null || opts.ajax === undefined) {
        return Promise.resolve(new Response('', { status: 503 }));
      }
      return Promise.resolve(json({ status: 'success', data: opts.ajax }));
    }
    if (u.includes('/api/permissions/global')) {
      return Promise.resolve(json({ data: opts.rechte ?? {} }));
    }
    if (u.includes('/api/songs')) {
      // Nur eine Seite: `getAllSongs` blättert, bis weniger als 100 kommen.
      return Promise.resolve(json({ data: opts.lieder ?? [] }));
    }
    throw new Error(`unerwarteter Aufruf: ${u}`);
  });
  return { ajaxAufrufe };
}

beforeEach(() => {
  __resetSessionMemosForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseSongEditRight – die einzige Stelle, die `edit songcategory` liest', () => {
  it('liest die erlaubten Kategorie-IDs aus der Liste', () => {
    const r = parseSongEditRight({ churchservice: { 'edit songcategory': [0, 1] } });
    expect(r).toEqual({ erlaubt: true, ids: [0, 1] });
  });

  it('eine leere Liste heißt: keine einzige Kategorie erlaubt', () => {
    expect(parseSongEditRight({ churchservice: { 'edit songcategory': [] } })).toEqual({
      erlaubt: false,
      ids: [],
    });
  });

  it('fehlendes Recht heißt nicht erlaubt', () => {
    expect(parseSongEditRight({ churchservice: {} })).toEqual({ erlaubt: false, ids: [] });
    expect(parseSongEditRight(undefined)).toEqual({ erlaubt: false, ids: [] });
  });

  /**
   * **`null` ist nicht `[]`.** Meldet ChurchTools das Recht formlos als „ja", ohne Kategorien zu
   * nennen, darf die App nicht selbst eingrenzen – sonst versteckt sie Kategorien, die erlaubt sind.
   */
  it('ein Recht ohne Aufzählung grenzt nicht ein (ids = null)', () => {
    expect(parseSongEditRight({ churchservice: { 'edit songcategory': true } })).toEqual({
      erlaubt: true,
      ids: null,
    });
  });

  it('lässt Unsinn in der Liste weg, statt daran zu scheitern', () => {
    const r = parseSongEditRight({ churchservice: { 'edit songcategory': [0, 'x', null, 2] } });
    expect(r).toEqual({ erlaubt: true, ids: [0, 2] });
  });
});

/**
 * **Gegenprobe zur Umstellung von `canEditSongs`.**
 *
 * `parseCapabilities` bildete das Recht früher selbst über `has()` ab; jetzt fragt es
 * `parseSongEditRight`. Das darf am Ergebnis **nichts** ändern – diese Tabelle hält genau das fest.
 * Ohne sie wäre eine Umstellung „nur intern" gewesen, die nebenbei ein Recht verschiebt.
 */
describe('canEditSongs fällt nach der Umstellung genauso aus wie vorher', () => {
  const FAELLE: [string, unknown, boolean][] = [
    ['Liste mit IDs', [0, 1], true],
    ['leere Liste', [], false],
    ['formloses Ja', true, true],
    ['formloses Nein', false, false],
    ['gar nicht vorhanden', undefined, false],
  ];

  for (const [name, wert, erwartet] of FAELLE) {
    it(`${name} → ${String(erwartet)}`, () => {
      const caps = parseCapabilities({
        churchservice: { 'view songcategory': [0], 'edit songcategory': wert },
      });
      expect(caps.canEditSongs).toBe(erwartet);
    });
  }

  it('ein Admin darf auch ohne Kategorie-Recht Lieder bearbeiten', () => {
    const caps = parseCapabilities({
      churchcore: { 'administer persons': [1] },
      churchservice: { 'edit songcategory': [] },
    });
    expect(caps.canEditSongs).toBe(true);
  });
});

describe('getSongCategories', () => {
  it('wandelt die Rohform um: id zur Zahl, `bezeichnung` zum Namen, nach sortkey sortiert', async () => {
    const { ajaxAufrufe } = mockCt({ ajax: MASTERDATA });
    const kategorien = await getSongCategories(COOKIE);
    expect(kategorien).toEqual([
      { id: 0, name: 'Aktive Songs' },
      { id: 1, name: 'Inaktive Songs' },
    ]);
    // Die IDs müssen Zahlen sein – sie werden später mit `song.category.id` verglichen.
    expect(kategorien.every((k) => typeof k.id === 'number')).toBe(true);
    expect(ajaxAufrufe[0]).toContain('func=getMasterData');
  });

  /**
   * Der Rückfall ist der Grund, warum die alte Schnittstelle hier tragbar ist: Ändert ChurchTools
   * sie, bleibt das Anlegen möglich – nur eventuell mit weniger Kategorien.
   */
  it('weicht auf die Lieder aus, wenn die alte Schnittstelle scheitert', async () => {
    mockCt({
      ajax: null,
      lieder: [
        lied(1, 'Treu', { id: 0, name: 'Aktive Songs' }),
        lied(2, 'Gnade', { id: 0, name: 'Aktive Songs' }),
      ],
    });
    expect(await getSongCategories(COOKIE)).toEqual([{ id: 0, name: 'Aktive Songs' }]);
  });

  it('weicht auch aus, wenn die alte Schnittstelle eine LEERE Liste liefert', async () => {
    // Ein `success` mit leerer Liste ist kein Fehler – aber auch keine Kategorie. Ohne diesen Zweig
    // stünde eine leere Auswahl da, obwohl die Lieder die Antwort kennen.
    mockCt({
      ajax: { songcategory: [] },
      lieder: [lied(1, 'Treu', { id: 3, name: 'Weihnachten' })],
    });
    expect(await getSongCategories(COOKIE)).toEqual([{ id: 3, name: 'Weihnachten' }]);
  });

  it('lässt Lieder ohne Kategorie einfach weg', async () => {
    mockCt({
      ajax: null,
      lieder: [lied(1, 'Ohne'), lied(2, 'Mit', { id: 0, name: 'Aktive Songs' })],
    });
    expect(await getSongCategories(COOKIE)).toEqual([{ id: 0, name: 'Aktive Songs' }]);
  });
});

describe('getEditableSongCategories – der Schnitt mit dem Recht', () => {
  it('gibt nur die Kategorien heraus, die das Recht nennt', async () => {
    mockCt({ ajax: MASTERDATA, rechte: { churchservice: { 'edit songcategory': [0] } } });
    expect(await getEditableSongCategories(COOKIE)).toEqual([{ id: 0, name: 'Aktive Songs' }]);
  });

  /**
   * **Der Ist-Zustand bei der ECG, kein Randfall:** Alle 49 Lieder liegen in Kategorie 0, erlaubt
   * sind `[0,1]`. Fällt die alte Schnittstelle aus, ist Kategorie 1 erlaubt, aber namenlos. Sie
   * WEGZULASSEN wäre der stille Weg – der Nutzer hätte ein Recht, das die App ihm verschweigt.
   */
  it('nennt eine erlaubte Kategorie ohne Namen „Kategorie N" statt sie zu verschweigen', async () => {
    mockCt({
      ajax: null,
      lieder: [lied(1, 'Treu', { id: 0, name: 'Aktive Songs' })],
      rechte: { churchservice: { 'edit songcategory': [0, 1] } },
    });
    expect(await getEditableSongCategories(COOKIE)).toEqual([
      { id: 0, name: 'Aktive Songs' },
      { id: 1, name: 'Kategorie 1' },
    ]);
  });

  it('grenzt bei einem Recht ohne Aufzählung nicht ein', async () => {
    mockCt({ ajax: MASTERDATA, rechte: { churchservice: { 'edit songcategory': true } } });
    expect(await getEditableSongCategories(COOKIE)).toEqual([
      { id: 0, name: 'Aktive Songs' },
      { id: 1, name: 'Inaktive Songs' },
    ]);
  });

  it('ohne Recht bleibt die Liste leer', async () => {
    mockCt({ ajax: MASTERDATA, rechte: { churchservice: { 'edit songcategory': [] } } });
    expect(await getEditableSongCategories(COOKIE)).toEqual([]);
  });

  /**
   * **Der Fall, der bei der ECG nie aufgefallen wäre.** Ein Administrator ohne zugewiesenes
   * Kategorie-Recht hat `edit songcategory: []`, aber `canEditSongs: true` – er sieht den Knopf
   * „Neues Lied". Ohne den Admin-Zweig stünde dahinter eine leere Auswahl. Hier ist `[0,1]` gesetzt,
   * bei einer anderen Gemeinde, die dieses Repo betreibt, vielleicht nicht.
   */
  it('ein Admin ohne Kategorie-Recht bekommt trotzdem alle Kategorien', async () => {
    mockCt({
      ajax: MASTERDATA,
      rechte: {
        churchcore: { 'administer persons': [1] },
        churchservice: { 'edit songcategory': [] },
      },
    });
    expect(await getEditableSongCategories(COOKIE)).toEqual([
      { id: 0, name: 'Aktive Songs' },
      { id: 1, name: 'Inaktive Songs' },
    ]);
  });
});
