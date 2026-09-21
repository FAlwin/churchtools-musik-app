import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  arrangementAendern,
  arrangementAnlegen,
  arrangementLoeschen,
  arrangementZumStandard,
  arrangementsLesen,
} from './arrangementVerwaltung.js';
import { __resetSessionMemosForTests } from './ctSessionMemos.js';

/**
 * Arrangements verwalten (#396).
 *
 * **Geprüft wird vor allem, was NICHT passieren darf** – dieselbe Linie wie bei `songVerwaltung`:
 *
 *  - ein Lied ohne Arrangement zurücklassen (das letzte löschen),
 *  - ein Lied ohne Standard zurücklassen (den Standard löschen),
 *  - eine Liednummer speichern, die ChurchTools stillschweigend wegwirft,
 *  - eine Quelle schicken, die es nicht gibt (ChurchTools verwirft sie ebenfalls still),
 *  - einen Standardwechsel melden, den ChurchTools gar nicht vollzogen hat.
 *
 * Der letzte Punkt ist der teuerste: Gemessen antwortet `PUT { isDefault: true }` mit **200 und
 * ändert nichts**. Deshalb glaubt dieser Dienst keinem Statuscode, sondern liest den Stand danach.
 *
 * Die Antwortformen stammen aus der Messung an der Test-Instanz (20.09.2026,
 * `server/scripts/probe-arrangements-alt.ts`).
 */
const COOKIE = 'ChurchTools_sid=abc';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Rechte-Antwort: darf in Kategorie 0 und 1 arbeiten. */
const RECHTE = { churchservice: { 'edit songcategory': [0, 1], 'view songcategory': [0, 1] } };

const MASTERDATA = {
  songcategory: [{ id: '0', bezeichnung: 'Aktive Songs', sortkey: '0' }],
  songsource: { '2': { id: '2', name: 'Unser Liederbuch', shorty: 'ULB', sortkey: '0' } },
};

interface Arr {
  id: number;
  name: string;
  isDefault?: boolean;
  key?: string | null;
  keyOfArrangement?: string | null;
  bpm?: number | string | null;
  tempo?: number | null;
  beat?: string | null;
  duration?: number | null;
  description?: string | null;
  note?: string | null;
  source?: { id: number; name: string; shorty: string } | null;
  sourceReference?: string | null;
  files?: unknown[];
}

function arr(over: Partial<Arr> & { id: number; name: string }): Arr {
  return {
    isDefault: false,
    key: 'C',
    keyOfArrangement: 'C',
    bpm: 120,
    beat: '4/4',
    duration: 300,
    description: null,
    source: null,
    sourceReference: null,
    files: [],
    ...over,
  };
}

const STANDARD = arr({ id: 70, name: 'Standard', isDefault: true });
const ZWEITES = arr({ id: 71, name: 'Akustik', key: 'G', keyOfArrangement: 'G' });

interface MockOpts {
  /** Die Arrangements des Liedes #7 – beim GET geliefert. */
  arrangements?: Arr[];
  /** Die Arrangements NACH dem Schreibvorgang (Standard: dieselben). */
  danach?: Arr[];
  /** Rechte-Antwort; Standard: darf in 0 und 1. */
  rechte?: unknown;
  /** Status für den POST (Standard 201). */
  postStatus?: number;
  /** ID, die der POST zurückgibt (Standard 88). */
  neueId?: number;
  /** Status für PUT/PATCH/DELETE (Standard 200/204). */
  schreibStatus?: number;
}

/** Alle Wege, die dieser Dienst berührt – nach URL und Methode unterschieden. */
function mockCt(opts: MockOpts = {}): { aufrufe: string[]; ruempfe: Map<string, string> } {
  const aufrufe: string[] = [];
  const ruempfe = new Map<string, string>();
  let geschrieben = false;

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
    if (m === 'GET' && /\/api\/songs\/7$/.test(u)) {
      // Nach dem Schreibvorgang die „danach"-Liste – so lässt sich prüfen, ob der Dienst wirklich
      // NACHSIEHT statt dem Statuscode zu glauben.
      const liste = geschrieben ? (opts.danach ?? opts.arrangements) : opts.arrangements;
      return Promise.resolve(
        json({
          data: {
            id: 7,
            name: 'Treu',
            category: { id: 0, name: 'Aktive Songs' },
            arrangements: liste ?? [STANDARD, ZWEITES],
          },
        }),
      );
    }
    if (m === 'POST' && /\/arrangements$/.test(u)) {
      geschrieben = true;
      const st = opts.postStatus ?? 201;
      return Promise.resolve(
        st >= 400
          ? new Response('', { status: st })
          : json({ data: { id: opts.neueId ?? 88 } }, st),
      );
    }
    if (m === 'PUT' || m === 'PATCH' || m === 'DELETE') {
      geschrieben = true;
      const st = opts.schreibStatus ?? (m === 'DELETE' ? 204 : 200);
      // 204 verträgt keinen Rumpf – so antwortet ChurchTools beim Löschen auch wirklich.
      return Promise.resolve(new Response(st === 204 || st >= 400 ? null : '{}', { status: st }));
    }
    return Promise.resolve(new Response('', { status: 404 }));
  });
  return { aufrufe, ruempfe };
}

beforeEach(() => __resetSessionMemosForTests());
afterEach(() => vi.restoreAllMocks());

describe('arrangementsLesen', () => {
  it('rechnet die ChurchTools-Felder in die App-Form um', async () => {
    mockCt();
    const liste = await arrangementsLesen(COOKIE, 7);
    expect(liste[0]).toEqual({
      id: 70,
      name: 'Standard',
      isDefault: true,
      key: 'C',
      tempo: 120,
      beat: '4/4',
      duration: 300,
      description: null,
      source: null,
      sourceReference: null,
      dateien: 0,
    });
  });

  it('verträgt das Tempo als Zeichenkette – so liefert ChurchTools es', async () => {
    mockCt({ arrangements: [arr({ id: 70, name: 'Standard', bpm: '134', tempo: null })] });
    expect((await arrangementsLesen(COOKIE, 7))[0].tempo).toBe(134);
  });

  /**
   * Ein unsinniges `bpm` darf **kein `NaN`** in die App-Form bringen: Über JSON wird daraus `null`.
   *
   * Dieser Test bewacht die **Zusage von `arrangementTempo`**, nicht mehr einen zweiten Prüfschritt
   * daneben: Bis zum 21.09.2026 fing ein eigenes `Number.isFinite` in der Rückgabe den Fehler der
   * hiesigen Kopie auf. Beim Zusammenführen fiel auf, dass dieser Test ohne die Zusammenführung
   * grün blieb – die Diagnose „auch diese Stelle schreibt NaN" war falsch. Mit dem entfernten
   * Doppelschutz fällt er, wenn jemand die Umrechnung wieder von Hand hinschreibt.
   */
  it('liefert bei unsinnigem Tempo `null` statt `NaN`', async () => {
    mockCt({ arrangements: [arr({ id: 70, name: 'Standard', bpm: 'irgendwas', tempo: null })] });
    const tempo = (await arrangementsLesen(COOKIE, 7))[0].tempo;
    expect(tempo).toBeNull();
    expect(Number.isNaN(tempo as number)).toBe(false);
  });

  it('liest eine Beschreibung auch unter dem alten Namen `note`', async () => {
    mockCt({
      arrangements: [arr({ id: 70, name: 'Standard', description: null, note: 'Kapo 2' })],
    });
    expect((await arrangementsLesen(COOKIE, 7))[0].description).toBe('Kapo 2');
  });

  it('zählt die Dateien – die Rückfrage vor dem Löschen nennt sie', async () => {
    mockCt({ arrangements: [arr({ id: 70, name: 'Standard', files: [{}, {}] })] });
    expect((await arrangementsLesen(COOKIE, 7))[0].dateien).toBe(2);
  });
});

describe('arrangementAnlegen', () => {
  it('legt an und liefert den Stand, den ChurchTools DANACH zeigt', async () => {
    const neu = arr({ id: 88, name: 'Akustik', key: 'G' });
    const { ruempfe } = mockCt({ danach: [STANDARD, neu], neueId: 88 });
    const ergebnis = await arrangementAnlegen(COOKIE, 7, { name: 'Akustik', key: 'G' });
    expect(ergebnis.id).toBe(88);
    expect(ergebnis.name).toBe('Akustik');
    const rumpf = JSON.parse(ruempfe.get('POST /api/songs/7/arrangements') ?? '{}') as {
      name: string;
      key: string;
      isDefault: boolean;
    };
    expect(rumpf.name).toBe('Akustik');
    expect(rumpf.key).toBe('G');
  });

  /**
   * **Nie als Standard**: Ein neues Arrangement soll dem Team nicht ungefragt das gewohnte vor der
   * Nase wegnehmen. Das ist am gesendeten Rumpf ablesbar, nicht am Ergebnis – deshalb wird er hier
   * geprüft und nicht die Antwort.
   */
  it('legt NIE als Standard an', async () => {
    const { ruempfe } = mockCt({ danach: [STANDARD, arr({ id: 88, name: 'Akustik' })] });
    await arrangementAnlegen(COOKIE, 7, { name: 'Akustik' });
    const rumpf = JSON.parse(ruempfe.get('POST /api/songs/7/arrangements') ?? '{}') as {
      isDefault: boolean;
    };
    expect(rumpf.isDefault).toBe(false);
  });

  it('meldet es, wenn ChurchTools das Arrangement danach nicht zeigt', async () => {
    // Die Lehre vom 11.08.2026: „201 mit ID" ist kein Beleg, dass etwas entstanden ist.
    mockCt({ danach: [STANDARD], neueId: 88 });
    await expect(arrangementAnlegen(COOKIE, 7, { name: 'Akustik' })).rejects.toThrow(
      /zeigt es nicht/,
    );
  });

  it('lehnt eine Liednummer ohne Quelle ab, statt sie wegwerfen zu lassen', async () => {
    mockCt();
    await expect(
      arrangementAnlegen(COOKIE, 7, { name: 'Akustik', sourceReference: '142' }),
    ).rejects.toThrow(/nur zusammen mit einer Quelle/);
  });

  it('lehnt eine Quelle ab, die ChurchTools nicht kennt', async () => {
    mockCt();
    await expect(arrangementAnlegen(COOKIE, 7, { name: 'Akustik', sourceId: 999 })).rejects.toThrow(
      /kennt ChurchTools nicht/,
    );
  });

  it('nimmt eine Quelle an, die in der Liste steht', async () => {
    mockCt({ danach: [STANDARD, arr({ id: 88, name: 'Akustik' })] });
    await expect(
      arrangementAnlegen(COOKIE, 7, { name: 'Akustik', sourceId: 2, sourceReference: '142' }),
    ).resolves.toBeTruthy();
  });

  it('prüft das Recht an der Kategorie des Liedes', async () => {
    mockCt({ rechte: { churchservice: { 'edit songcategory': [5] } } });
    await expect(arrangementAnlegen(COOKIE, 7, { name: 'Akustik' })).rejects.toThrow(
      /keine Lieder ändern/,
    );
  });
});

describe('arrangementAendern', () => {
  it('schreibt den vollständigen Payload – lesen–ändern–schreiben', async () => {
    const { ruempfe } = mockCt();
    await arrangementAendern(COOKIE, 7, 71, { name: 'Akustik neu' });
    const rumpf = JSON.parse(ruempfe.get('PUT /api/songs/7/arrangements/71') ?? '{}') as Record<
      string,
      unknown
    >;
    expect(rumpf.name).toBe('Akustik neu');
    // Die übrigen Felder gehen mit, sonst löscht ChurchTools sie.
    expect(rumpf.key).toBe('G');
    expect(rumpf.duration).toBe(300);
    expect(rumpf.beat).toBe('4/4');
  });

  it('meldet ein Arrangement, das es am Lied nicht gibt', async () => {
    mockCt();
    await expect(arrangementAendern(COOKIE, 7, 999, { name: 'X' })).rejects.toThrow(
      /nicht \(mehr\)/,
    );
  });

  it('lehnt eine Liednummer ab, wenn die Quelle im selben Zug entfernt wird', async () => {
    mockCt({
      arrangements: [
        STANDARD,
        arr({
          id: 71,
          name: 'Akustik',
          source: { id: 2, name: 'Unser Liederbuch', shorty: 'ULB' },
          sourceReference: '142',
        }),
      ],
    });
    await expect(
      arrangementAendern(COOKIE, 7, 71, { sourceId: null, sourceReference: '142' }),
    ).rejects.toThrow(/nur zusammen mit einer Quelle/);
  });
});

describe('arrangementZumStandard', () => {
  it('geht über PATCH …/default – nicht über PUT { isDefault }', async () => {
    const { aufrufe } = mockCt({
      danach: [
        arr({ id: 70, name: 'Standard' }),
        arr({ id: 71, name: 'Akustik', isDefault: true }),
      ],
    });
    await arrangementZumStandard(COOKIE, 7, 71);
    expect(aufrufe).toContain('PATCH /api/songs/7/arrangements/71/default');
    expect(aufrufe.some((a) => a.startsWith('PUT /api/songs/7/arrangements/71'))).toBe(false);
  });

  /**
   * **Der teuerste Test dieser Datei.** ChurchTools antwortet auf den falschen Weg mit 200 und tut
   * nichts (gemessen). Ein Dienst, der dem Statuscode glaubt, meldet „erledigt", und das Team
   * spielt weiter nach dem alten Standard.
   */
  it('meldet einen Wechsel NICHT, wenn ChurchTools ihn gar nicht vollzogen hat', async () => {
    mockCt({ danach: [STANDARD, ZWEITES] }); // #70 ist immer noch Standard
    await expect(arrangementZumStandard(COOKIE, 7, 71)).rejects.toThrow(/nicht auf/);
  });

  it('liefert die GANZE Liste zurück – der Wechsel betrifft immer zwei Einträge', async () => {
    mockCt({
      danach: [
        arr({ id: 70, name: 'Standard' }),
        arr({ id: 71, name: 'Akustik', isDefault: true }),
      ],
    });
    const liste = await arrangementZumStandard(COOKIE, 7, 71);
    expect(liste.map((a) => [a.id, a.isDefault])).toEqual([
      [70, false],
      [71, true],
    ]);
  });
});

describe('arrangementLoeschen – die beiden Geländer', () => {
  it('löscht ein gewöhnliches Arrangement und nennt seinen Namen', async () => {
    const { aufrufe } = mockCt();
    expect(await arrangementLoeschen(COOKIE, 7, 71)).toEqual({ name: 'Akustik' });
    expect(aufrufe).toContain('DELETE /api/songs/7/arrangements/71');
  });

  it('lässt das LETZTE Arrangement nicht löschen – ein Lied ohne wäre unbrauchbar', async () => {
    const { aufrufe } = mockCt({ arrangements: [STANDARD] });
    await expect(arrangementLoeschen(COOKIE, 7, 70)).rejects.toThrow(/einzige Arrangement/);
    // Und es wurde nichts geschrieben, nicht nur gemeldet.
    expect(aufrufe.some((a) => a.startsWith('DELETE'))).toBe(false);
  });

  it('lässt das STANDARD-Arrangement nicht löschen, solange es andere gibt', async () => {
    const { aufrufe } = mockCt();
    await expect(arrangementLoeschen(COOKIE, 7, 70)).rejects.toThrow(/Standard-Arrangement/);
    expect(aufrufe.some((a) => a.startsWith('DELETE'))).toBe(false);
  });
});
