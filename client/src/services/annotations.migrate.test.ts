// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { migrateLocalAnnotations, resetSync } from './annotations';
import { setSessionExpiredHandler } from './api';

/**
 * Letzter offener Punkt aus #192: die **einmalige** Übernahme bestehender Geräte-Anmerkungen aufs
 * Konto. Der Pfad läuft genau einmal pro Gerät – wenn er falsch liegt, sind jahrelang gesammelte
 * Anmerkungen entweder weg oder landen unter falschen Schlüsseln, und niemand merkt es rechtzeitig.
 *
 * Zwei Dinge sind besonders heikel und deshalb hier festgehalten:
 *  - Der **Merker** darf nur gesetzt werden, wenn die Übernahme wirklich durch ist. Wird er nach
 *    einem 401 gesetzt, ist der Zug für dieses Gerät für immer abgefahren.
 *  - **Dokument-Anmerkungen bleiben lokal** (sie hängen an einer ChurchTools-Datei-ID, nicht an
 *    Lied + Version) – sie dürfen nicht mit hochgeladen werden.
 */
const DRAW = 'worship_docdraw_';
const ZOOM = 'worship_doczoom_';
const FLAG = 'worship_anno_migrated_v1';

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Die hochgeladenen Einträge als `{ schlüssel: rumpf }`. */
function uploads(mock: ReturnType<typeof vi.fn>): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const call of mock.mock.calls) {
    const init = call[1] as RequestInit | undefined;
    if (init?.method !== 'PUT') continue;
    const key = decodeURIComponent(String(call[0]).replace('/api/annotations/', ''));
    out[key] = JSON.parse(String(init.body)) as Record<string, unknown>;
  }
  return out;
}

function okFetch() {
  const m = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200)));
  vi.stubGlobal('fetch', m);
  return m;
}

beforeEach(() => {
  localStorage.clear();
  resetSync();
  setSessionExpiredHandler(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetSync();
});

describe('migrateLocalAnnotations – was hochgeladen wird', () => {
  it('nimmt Striche, Texte und Zoom EINER Seite in einen Eintrag zusammen', async () => {
    localStorage.setItem(`${DRAW}song7_voriginal_0`, 'data:image/png;base64,AAA');
    localStorage.setItem(
      `${DRAW}song7_voriginal_0_text`,
      JSON.stringify([{ id: 1, fx: 0.1, fy: 0.2, text: 'Hi', color: '#000', sizeCqh: 2 }]),
    );
    localStorage.setItem(`${ZOOM}song7_voriginal_0`, JSON.stringify({ x: 1, y: 2, scale: 3 }));

    const f = okFetch();
    await migrateLocalAnnotations();

    const sent = uploads(f);
    expect(Object.keys(sent)).toEqual(['song7_voriginal_0']);
    expect(Object.keys(sent.song7_voriginal_0).sort()).toEqual(['strokes', 'texts', 'zoom']);
  });

  it('hebt alte versionslose Schlüssel auf das neue Schema (song12_3 → song12_voriginal_3)', async () => {
    localStorage.setItem(`${DRAW}song12_3`, 'strich');
    const f = okFetch();
    await migrateLocalAnnotations();
    expect(Object.keys(uploads(f))).toEqual(['song12_voriginal_3']);
  });

  it('lässt Dokument-Anmerkungen lokal (sie hängen an einer Datei-ID, nicht an Lied+Version)', async () => {
    localStorage.setItem(`${DRAW}213_0`, 'strich');
    localStorage.setItem(`${DRAW}213_0_text`, JSON.stringify([{ id: 1, text: 'x' }]));
    const f = okFetch();
    await migrateLocalAnnotations();
    expect(uploads(f)).toEqual({});
  });

  it('ignoriert die alten seiten-globalen Zoom-Schlüssel (worship_doczoom_p3)', async () => {
    localStorage.setItem(`${ZOOM}p3`, JSON.stringify({ x: 0, y: 0, scale: 2 }));
    const f = okFetch();
    await migrateLocalAnnotations();
    expect(uploads(f)).toEqual({});
  });

  it('überspringt leere Texte und kaputtes JSON, statt Müll hochzuladen', async () => {
    localStorage.setItem(`${DRAW}song1_voriginal_0_text`, '[]'); // leer
    localStorage.setItem(`${DRAW}song2_voriginal_0_text`, '{kaputt'); // unlesbar
    localStorage.setItem(`${ZOOM}song3_voriginal_0`, 'auch kaputt');
    const f = okFetch();
    await migrateLocalAnnotations();
    expect(uploads(f)).toEqual({});
  });

  it('nimmt die „Nur Text"-Ebene und den Querformat-Zoom mit', async () => {
    localStorage.setItem(`${DRAW}song5_voriginal_lyr_1`, 'strich');
    localStorage.setItem(
      `${ZOOM}song5_voriginal_1_dlarge2`,
      JSON.stringify({ x: 0, y: 0, scale: 2 }),
    );
    const f = okFetch();
    await migrateLocalAnnotations();
    expect(Object.keys(uploads(f)).sort()).toEqual([
      'song5_voriginal_1_dlarge2',
      'song5_voriginal_lyr_1',
    ]);
  });
});

describe('migrateLocalAnnotations – der Merker', () => {
  it('wird nach erfolgreicher Übernahme gesetzt und verhindert einen zweiten Lauf', async () => {
    localStorage.setItem(`${DRAW}song7_voriginal_0`, 'strich');
    const f = okFetch();

    await migrateLocalAnnotations();
    expect(localStorage.getItem(FLAG)).toBe('1');
    const nachErstem = f.mock.calls.length;

    await migrateLocalAnnotations();
    expect(f.mock.calls.length).toBe(nachErstem); // kein zweiter Durchlauf
  });

  it('wird bei 401 NICHT gesetzt – sonst wäre die Übernahme für dieses Gerät für immer verpasst', async () => {
    localStorage.setItem(`${DRAW}song7_voriginal_0`, 'strich');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(jsonResponse(401, { error: 'Nicht angemeldet.' })),
        ),
    );

    await migrateLocalAnnotations();
    expect(localStorage.getItem(FLAG)).toBeNull();
  });

  it('einzelne Fehlschläge (z. B. zu groß) überspringen nur ihren Eintrag', async () => {
    localStorage.setItem(`${DRAW}song1_voriginal_0`, 'strich');
    localStorage.setItem(`${DRAW}song2_voriginal_0`, 'strich');
    const f = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          String(url).includes('song1')
            ? jsonResponse(413, { error: 'zu groß' })
            : jsonResponse(200),
        ),
      );
    vi.stubGlobal('fetch', f);

    await migrateLocalAnnotations();

    // Beide wurden versucht, und der Merker steht – der Vorgang gilt als erledigt.
    expect(Object.keys(uploads(f)).sort()).toEqual(['song1_voriginal_0', 'song2_voriginal_0']);
    expect(localStorage.getItem(FLAG)).toBe('1');
  });

  it('ohne lokale Anmerkungen wird nichts geschickt, der Merker aber gesetzt', async () => {
    const f = okFetch();
    await migrateLocalAnnotations();
    expect(uploads(f)).toEqual({});
    expect(localStorage.getItem(FLAG)).toBe('1');
  });
});
