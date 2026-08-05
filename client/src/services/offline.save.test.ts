// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgendaItem } from '@shared/types/index';

/**
 * #277: „Für offline speichern" meldete Erfolg, ohne eine einzige Datei geladen zu haben.
 *
 * Zwei Fehler zusammen: `await fetch(url)` wirft bei **502/504 nicht** (das ist eine ganz normale
 * Antwort), und `res.ok` wurde nie geprüft. Danach wurde der Gottesdienst **bedingungslos** als
 * „vollständig gespeichert" ins Verzeichnis eingetragen – wer sich darauf verließ, stand im Saal ohne
 * Dokumente. Also genau in der Lage, für die das Feature gebaut wurde.
 *
 * `saveOfflineNow` (schreibt die React-Query-Daten nach IndexedDB) ist gemockt: Hier geht es um die
 * Dateien und um den Verzeichnis-Eintrag.
 */
vi.mock('../queryClient', () => ({ saveOfflineNow: vi.fn().mockResolvedValue(undefined) }));

const { saveServiceOffline, getOfflineRegistry } = await import('./offline');

const SERVICE = { id: 77, date: '2026-09-06' };

/** Ablauf mit einem Lied, das `n` Dokumente hat. */
function itemsMitDokumenten(n: number): AgendaItem[] {
  return [
    {
      id: 1,
      title: 'Lied',
      type: 'song',
      song: {
        id: 5,
        documents: Array.from({ length: n }, (_, i) => ({ fileId: 100 + i, type: 'pdf' })),
      },
    },
  ] as unknown as AgendaItem[];
}

function response(status: number): Response {
  return new Response('x', { status });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('saveServiceOffline – vollständig geladen', () => {
  it('alle Dateien da: Ergebnis ohne Fehlschläge, Termin steht im Verzeichnis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200)));

    const res = await saveServiceOffline(SERVICE, itemsMitDokumenten(3));

    expect(res).toEqual({ total: 3, failed: 0 });
    expect(getOfflineRegistry()[77]).toBeDefined();
  });

  it('ein Ablauf ohne Dokumente gilt als vollständig', async () => {
    // Sonst wäre ein Gottesdienst ohne PDFs nie „offline verfügbar".
    vi.stubGlobal('fetch', vi.fn());

    const res = await saveServiceOffline(SERVICE, itemsMitDokumenten(0));

    expect(res).toEqual({ total: 0, failed: 0 });
    expect(getOfflineRegistry()[77]).toBeDefined();
  });

  it('meldet den Fortschritt für jede Datei', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200)));
    const onProgress = vi.fn();

    await saveServiceOffline(SERVICE, itemsMitDokumenten(2), onProgress);

    expect(onProgress).toHaveBeenCalledWith(0, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });
});

describe('saveServiceOffline – Dateien fehlen (#277)', () => {
  it('502 zählt als Fehlschlag – DAS war der stille Fall', async () => {
    // `fetch` wirft hier nicht: Ohne die `res.ok`-Prüfung galt die Datei als geladen.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(502)));

    const res = await saveServiceOffline(SERVICE, itemsMitDokumenten(2));

    expect(res).toEqual({ total: 2, failed: 2 });
  });

  it('504 (Zeitüberschreitung zu ChurchTools) zählt ebenfalls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(504)));
    expect((await saveServiceOffline(SERVICE, itemsMitDokumenten(1))).failed).toBe(1);
  });

  it('ein echter Netzfehler zählt weiterhin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect((await saveServiceOffline(SERVICE, itemsMitDokumenten(2))).failed).toBe(2);
  });

  it('unvollständig wird NICHT als gespeichert eingetragen', async () => {
    // Der Kern: Kein Offline-Symbol am Termin, solange etwas fehlt. Sonst verlässt sich jemand darauf.
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(response(++n === 1 ? 200 : 502))),
    );

    const res = await saveServiceOffline(SERVICE, itemsMitDokumenten(3));

    expect(res.failed).toBe(2);
    expect(getOfflineRegistry()[77]).toBeUndefined();
  });

  it('ein früherer vollständiger Stand wird durch einen Teil-Versuch nicht überschrieben', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200)));
    await saveServiceOffline(SERVICE, itemsMitDokumenten(1));
    const vorher = getOfflineRegistry()[77]?.savedAt;
    expect(vorher).toBeDefined();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(502)));
    await saveServiceOffline(SERVICE, itemsMitDokumenten(1));

    // Der alte, ehrlich vollständige Zeitpunkt bleibt stehen – er war ja mal wahr.
    expect(getOfflineRegistry()[77]?.savedAt).toBe(vorher);
  });
});
