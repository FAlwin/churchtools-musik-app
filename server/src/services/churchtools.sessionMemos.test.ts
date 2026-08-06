import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getUserId, logout } from './ctAuth.js';
import { getCapabilitiesCached } from './ctCapabilities.js';
import { __resetSessionMemosForTests, forgetSession } from './ctSessionMemos.js';
import { __getCsrfTokenForTests as getCsrfToken } from './ctCsrf.js';

/**
 * Vier Dinge hängen am Session-Cookie: Konto-ID (12 h), Rechte (5 min), CSRF-Token (1 min) und der
 * gerade laufende Token-Abruf.
 *
 * Zwei von ihnen – Konto-ID und Rechte – hatten **gar keine Tests**, obwohl sie mit #306 auf den
 * gemeinsamen `ttlMemo`-Baustein umgestellt wurden. Ungetesteten Code umzubauen ist der übliche Weg
 * zum stillen Bruch, deshalb diese Datei.
 *
 * Der wichtigste Test steht unten: **Abmelden muss ALLE drei leeren.** Vorher räumte `logout` nur die
 * Konto-ID; Rechte und Token blieben unter demselben Cookie stehen. Wieder „die Regel gilt für A, B,
 * C – C fehlt".
 */
const CAPS = {
  'churchdb:view': [{ id: 1 }],
} as const;

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Beantwortet whoami und die Rechte-Abfrage; zählt beides getrennt mit. */
function ctMock() {
  const zaehler = { whoami: 0, rechte: 0, logout: 0 };
  const f = vi.fn((url: string | URL) => {
    const u = String(url);
    if (u.includes('/api/whoami')) {
      zaehler.whoami++;
      return Promise.resolve(jsonRes({ data: { id: 7, firstName: 'A', lastName: 'F' } }));
    }
    if (u.includes('/api/permissions/global')) {
      zaehler.rechte++;
      return Promise.resolve(jsonRes({ data: CAPS }));
    }
    if (u.includes('/api/logout')) {
      zaehler.logout++;
      return Promise.resolve(jsonRes({}));
    }
    return Promise.resolve(jsonRes({ data: {} }));
  });
  vi.stubGlobal('fetch', f);
  return zaehler;
}

beforeEach(() => {
  __resetSessionMemosForTests();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('getUserId – Konto-ID-Memo', () => {
  it('fragt ChurchTools nur EINMAL, danach aus dem Speicher', async () => {
    const z = ctMock();
    expect(await getUserId('cookie-a')).toBe(7);
    expect(await getUserId('cookie-a')).toBe(7);
    expect(z.whoami).toBe(1);
  });

  it('verschiedene Sitzungen werden nicht vermischt', async () => {
    const z = ctMock();
    await getUserId('cookie-a');
    await getUserId('cookie-b');
    expect(z.whoami).toBe(2);
  });

  it('nach zwölf Stunden wird wieder frisch gefragt', async () => {
    // Der Sinn der Auffrischung: periodisch prüfen, ob das Cookie überhaupt noch gilt.
    const z = ctMock();
    await getUserId('cookie-a');
    await vi.advanceTimersByTimeAsync(12 * 3_600_000 + 1000);
    await getUserId('cookie-a');
    expect(z.whoami).toBe(2);
  });

  it('kurz vor Ablauf kommt die Antwort noch aus dem Speicher', async () => {
    const z = ctMock();
    await getUserId('cookie-a');
    await vi.advanceTimersByTimeAsync(11 * 3_600_000);
    await getUserId('cookie-a');
    expect(z.whoami).toBe(1);
  });
});

describe('getCapabilitiesCached – Rechte-Memo', () => {
  it('fragt die Rechte nur EINMAL je fünf Minuten', async () => {
    const z = ctMock();
    await getCapabilitiesCached('cookie-a', 7);
    await getCapabilitiesCached('cookie-a', 7);
    expect(z.rechte).toBe(1);
  });

  it('nach fünf Minuten wird wieder frisch gefragt', async () => {
    // Wichtig, damit vom Admin geänderte Rechte greifen, ohne dass jemand neu anmelden muss.
    const z = ctMock();
    await getCapabilitiesCached('cookie-a', 7);
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1000);
    await getCapabilitiesCached('cookie-a', 7);
    expect(z.rechte).toBe(2);
  });

  it('verschiedene Sitzungen bekommen eigene Rechte (#199)', async () => {
    const z = ctMock();
    await getCapabilitiesCached('cookie-a', 7);
    await getCapabilitiesCached('cookie-b', 8);
    expect(z.rechte).toBe(2);
  });
});

describe('Abmelden leert ALLE sitzungsgebundenen Speicher', () => {
  it('nach dem Abmelden werden Konto-ID UND Rechte neu geholt', async () => {
    // Der eigentliche Fix: Vorher räumte `logout` nur die Konto-ID. Die Rechte blieben unter dem
    // abgemeldeten Cookie bis zu fünf Minuten stehen und wurden ohne Rückfrage an ChurchTools
    // weiterhin ausgeliefert.
    const z = ctMock();
    await getUserId('cookie-a');
    await getCapabilitiesCached('cookie-a', 7);
    expect(z.whoami).toBe(1);
    expect(z.rechte).toBe(1);

    await logout('cookie-a');

    await getUserId('cookie-a');
    await getCapabilitiesCached('cookie-a', 7);
    expect(z.whoami).toBe(2);
    expect(z.rechte).toBe(2);
  });

  it('das Abmelden der einen Sitzung lässt die andere unberührt', async () => {
    // Gegenrichtung: Ein `clear()` statt eines gezielten `delete` wäre hier durchgefallen – dann
    // müssten sich alle anderen Angemeldeten die Daten neu holen.
    const z = ctMock();
    await getUserId('cookie-a');
    await getUserId('cookie-b');
    expect(z.whoami).toBe(2);

    await logout('cookie-a');

    await getUserId('cookie-b');
    expect(z.whoami).toBe(2); // b kam weiterhin aus dem Speicher
  });
});

describe('Abmelden WÄHREND ein Token geholt wird (#280)', () => {
  it('das Token landet danach NICHT im Speicher', async () => {
    // Der Sonderfall, der die Zusage des Moduls sonst unterläuft: `forgetSession` räumt auf, aber der
    // schon laufende Abruf schriebe sein Ergebnis danach hinein – ein totes Cookie hätte eine Minute
    // lang ein gültiges Token. Praktisch harmlos (ChurchTools nimmt das Cookie ohnehin nicht mehr),
    // aber „forgetSession kennt alle" wäre schlicht nicht wahr.
    let freigeben: (() => void) | null = null;
    const wartet = new Promise<void>((r) => (freigeben = r));
    let geholt = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      geholt++;
      await wartet; // erster Abruf hängt, bis der Test ihn freigibt
      return new Response(JSON.stringify({ data: `token-${geholt}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const laufend = getCsrfToken('cookie-a');
    await Promise.resolve(); // Abruf hat begonnen und steht im Inflight-Speicher
    forgetSession('cookie-a'); // ← das Abmelden mittendrin
    freigeben!();
    await laufend;

    // Wäre das Token gemerkt worden, käme es jetzt aus dem Speicher und `geholt` bliebe bei 1.
    await getCsrfToken('cookie-a');
    expect(geholt).toBe(2);
  });

  it('ohne Abmelden bleibt das Token liegen – die Gegenrichtung', async () => {
    let geholt = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      geholt++;
      return Promise.resolve(
        new Response(JSON.stringify({ data: `token-${geholt}` }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    await getCsrfToken('cookie-b');
    await getCsrfToken('cookie-b');
    expect(geholt).toBe(1);
  });
});
