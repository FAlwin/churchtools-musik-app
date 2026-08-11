import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  uploadChordpro,
  uploadFile,
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
 * wortgleich** im Code. Seit #321 sind es acht – `uploadFile` kam als allgemeiner Datei-Upload hinzu.
 *
 * Dieser Test prüft die Regel für **jede einzelne** dieser Funktionen, nicht für eine
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

/** Die acht Schreiboperationen, jede mit gültigen Argumenten. */
const SCHREIBER: Array<[string, () => Promise<void>]> = [
  ['uploadChordpro', () => uploadChordpro(COOKIE, 5, 'lied.cho', 'inhalt')],
  [
    'uploadFile',
    () => uploadFile(COOKIE, 5, { filename: 'blatt.pdf', mime: 'application/pdf', inhalt: 'x' }),
  ],
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

/**
 * #321, Schritt 1: `uploadChordpro` war auf ChordPro zugeschnitten (`text/plain` festverdrahtet).
 * Für die Dateiverwaltung braucht es beliebige Arten – als **gemeinsame** Funktion, nicht als zweite
 * Fassung daneben.
 *
 * Geprüft wird deshalb nicht nur, dass `uploadFile` funktioniert, sondern dass `uploadChordpro`
 * WIRKLICH darüber läuft und dabei sein Verhalten behält. Sonst stünden hinterher doch zwei
 * Fassungen da, nur eine davon getestet.
 */
describe('uploadFile – die einzige Stelle, die einen Datei-Upload zusammenbaut (#321)', () => {
  /** Fängt den Schreibvorgang ab und gibt die gesendete Datei zurück. */
  function mockUpload() {
    const gesendet: { url: string; datei: File | null } = { url: '', datei: null };
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const u = String(url);
      if (u.includes('/api/csrftoken')) return Promise.resolve(jsonRes('token-1'));
      gesendet.url = u;
      const body = init?.body;
      const teil = body instanceof FormData ? body.get('files[]') : null;
      gesendet.datei = teil instanceof File ? teil : null;
      return Promise.resolve(jsonRes(null, 200));
    });
    return gesendet;
  }

  it('schickt die übergebene Art mit – nicht text/plain', async () => {
    const g = mockUpload();
    await uploadFile(COOKIE, 7, {
      filename: 'Treu - E.pdf',
      mime: 'application/pdf',
      inhalt: new Uint8Array([1, 2, 3]),
    });

    expect(g.url).toContain('/api/files/song_arrangement/7');
    expect(g.datei?.name).toBe('Treu - E.pdf');
    expect(g.datei?.type).toBe('application/pdf');
    // Bytes, nicht Text: Ein PDF darf nicht als Zeichenkette verstümmelt werden.
    expect(g.datei?.size).toBe(3);
  });

  it('uploadChordpro läuft darüber und bleibt bei text/plain', async () => {
    const g = mockUpload();
    await uploadChordpro(COOKIE, 7, 'Treu — Akustik (App).chordpro', '{title: Treu}');

    expect(g.datei?.name).toBe('Treu — Akustik (App).chordpro');
    expect(g.datei?.type).toBe('text/plain');
  });

  it('meldet einen Fehlschlag, statt still zu tun als wäre gespeichert', async () => {
    // #270: Ein vorübergehender Fehler darf nicht wie Erfolg aussehen – sonst hält der Nutzer die
    // Datei für hochgeladen und sie ist nirgends.
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(String(url).includes('/api/csrftoken') ? jsonRes('t') : jsonRes(null, 504)),
    );
    await expect(
      uploadFile(COOKIE, 7, { filename: 'a.pdf', mime: 'application/pdf', inhalt: 'x' }),
    ).rejects.toThrow(/Hochladen nach ChurchTools fehlgeschlagen \(504\)/);
  });

  it('die ChordPro-Meldung bleibt wortgleich, nicht die allgemeine', async () => {
    // „Speichern" ist beim Bearbeiten einer Version die richtige Handlung; „Hochladen" wäre für den
    // Nutzer etwas anderes. Die Verallgemeinerung darf den Wortlaut nicht mitverändern.
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(String(url).includes('/api/csrftoken') ? jsonRes('t') : jsonRes(null, 504)),
    );
    await expect(uploadChordpro(COOKIE, 7, 'a.chordpro', 'x')).rejects.toThrow(
      /Speichern in ChurchTools fehlgeschlagen \(504\)/,
    );
  });
});
