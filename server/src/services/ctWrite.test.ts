import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  uploadChordpro,
  reorderAgenda,
  createAgendaItem,
  updateAgendaItem,
  deleteAgendaItem,
  setAgendaItemHidden,
  deleteFile,
} from './ctWrite.js';
import { __resetSessionMemosForTests } from './ctSessionMemos.js';

/**
 * #280: Alle Schreiboperationen teilen sich seit dem Aufteilen EINEN Helfer (`schreibe`). Vorher stand
 * das Ritual – Token holen, mitschicken, bei 401/403 über `csrfWriteDenied` melden – **siebenmal
 * wortgleich** im Code.
 *
 * Dieser Test prüft die Regel für **jede einzelne** der sieben Funktionen, nicht für eine
 * stellvertretend. Genau darum geht es: Die Fehlerklasse dieses Projekts ist „die Regel gilt für A, B,
 * C – C fehlt". Ein Test, der nur `deleteFile` prüft, hätte eine vergessene achte Stelle nie bemerkt.
 *
 * Geprüft wird das **beobachtbare Verhalten**: Nach einer Ablehnung muss der nächste Versuch ein
 * FRISCHES Token holen. Bliebe das abgelehnte liegen, wäre das eine Sackgasse, aus der nur ein
 * Neustart hülfe (#298).
 */
const COOKIE = 'ChurchTools_sid=abc';

/** Ein Ablaufpunkt, wie ChurchTools ihn liefert – reicht für die Nutzlast-Erzeugung. */
const PUNKT = { id: 1, title: 'Lied', position: 0, type: 'song' };

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Beantwortet Token- und Ablauf-Abrufe normal, lässt aber **jeden Schreibvorgang** an einem 403
 * scheitern. Zählt dabei mit, wie oft ein Token geholt wurde.
 */
function mockMitAblehnung() {
  const zaehler = { token: 0 };
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (u.includes('/api/csrftoken')) {
      zaehler.token++;
      return Promise.resolve(jsonRes(`token-${zaehler.token}`));
    }
    if (method === 'GET' && u.includes('/agenda')) {
      return Promise.resolve(jsonRes({ items: [PUNKT] }));
    }
    return Promise.resolve(jsonRes(null, 403)); // der eigentliche Schreibvorgang
  });
  return zaehler;
}

/** Die sieben Schreiboperationen, jede mit gültigen Argumenten. */
const SCHREIBER: Array<[string, () => Promise<void>]> = [
  ['uploadChordpro', () => uploadChordpro(COOKIE, 5, 'lied.cho', 'inhalt')],
  ['reorderAgenda', () => reorderAgenda(COOKIE, 9, [1])],
  ['createAgendaItem', () => createAgendaItem(COOKIE, 9, { type: 'header', title: 'Neu' })],
  ['updateAgendaItem', () => updateAgendaItem(COOKIE, 9, 1, { title: 'Anders' })],
  ['deleteAgendaItem', () => deleteAgendaItem(COOKIE, 9, 1)],
  ['setAgendaItemHidden', () => setAgendaItemHidden(COOKIE, 9, 1, true)],
  ['deleteFile', () => deleteFile(COOKIE, 42)],
];

beforeEach(() => __resetSessionMemosForTests());
afterEach(() => vi.restoreAllMocks());

describe('Jede Schreiboperation verwirft das Token bei einer Ablehnung (#280/#298)', () => {
  it.each(SCHREIBER)('%s', async (_name, aufrufen) => {
    const z = mockMitAblehnung();

    await expect(aufrufen()).rejects.toThrow(); // 403 → Fehler, nicht stiller Erfolg
    expect(z.token).toBe(1);

    // Der zweite Versuch darf NICHT dasselbe abgelehnte Token wiederverwenden.
    await expect(aufrufen()).rejects.toThrow();
    expect(z.token).toBe(2);
  });
});

describe('Ohne Ablehnung bleibt das Token liegen – sonst spart der Speicher nichts', () => {
  it.each(SCHREIBER)('%s', async (_name, aufrufen) => {
    const zaehler = { token: 0 };
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      if (u.includes('/api/csrftoken')) {
        zaehler.token++;
        return Promise.resolve(jsonRes(`token-${zaehler.token}`));
      }
      if (method === 'GET' && u.includes('/agenda')) {
        return Promise.resolve(jsonRes({ items: [PUNKT] }));
      }
      return Promise.resolve(jsonRes(null, 200));
    });

    await aufrufen();
    await aufrufen();
    expect(zaehler.token).toBe(1); // beide Male dasselbe Token
  });
});
