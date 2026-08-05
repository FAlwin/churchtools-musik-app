import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ChurchTools mocken – Nutzungsstatistik ohne echtes ChurchTools testen.
// `importOriginal`, damit `isCtOverloaded` und `CtOverloadedError` die ECHTEN sind (#300): Mit einem
// leeren Mock waeren sie `undefined`, und die Notbremse-Tests wuerden an der Attrappe scheitern statt
// am Verhalten. Nur die zwei ChurchTools-Abrufe sind ersetzt.
vi.mock('./churchtools.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./churchtools.js')>()),
  getEvents: vi.fn(),
  getAgenda: vi.fn(),
}));

import {
  getSongUsageMap,
  invalidateSongUsageCache,
  __resetSongUsageForTests,
} from './setlistBuilder.js';
import { getEvents, getAgenda, CtOverloadedError } from './churchtools.js';
import { HttpError } from '../middleware/errorHandler.js';

const mockedGetEvents = vi.mocked(getEvents);
const mockedGetAgenda = vi.mocked(getAgenda);
type EventsResult = Awaited<ReturnType<typeof getEvents>>;
type AgendaResult = Awaited<ReturnType<typeof getAgenda>>;

const agendaWith = (...songIds: number[]) =>
  ({
    items: songIds.map((songId, i) => ({ id: i + 1, song: { songId } })),
  }) as unknown as AgendaResult;

beforeEach(() => {
  __resetSongUsageForTests(); // Cache, laufender Abruf UND Sperrfrist (#300)
  mockedGetEvents.mockReset();
  mockedGetAgenda.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('getSongUsageMap – Spieltermine je Lied', () => {
  it('sammelt vergangene Termine je Lied, neuester zuerst; zählt Zukunft NICHT mit', async () => {
    mockedGetEvents.mockResolvedValue([
      { id: 1, startDate: '2026-06-01T09:00:00Z' },
      { id: 2, startDate: '2026-07-05T09:00:00Z' },
      { id: 3, startDate: '2026-08-01T09:00:00Z' }, // Zukunft → ignorieren
    ] as unknown as EventsResult);
    mockedGetAgenda.mockImplementation(async (_cookie: string, eventId: number) => {
      if (eventId === 1) return agendaWith(10);
      if (eventId === 2) return agendaWith(10, 20);
      return agendaWith(30); // Zukunftstermin
    });

    const usage = await getSongUsageMap('cookie');

    expect(usage[10].dates).toEqual(['2026-07-05', '2026-06-01']); // absteigend
    expect(usage[20].dates).toEqual(['2026-07-05']);
    expect(usage[30]).toBeUndefined(); // Zukunft nicht gezählt
    // Zukunftstermin (Event 3) wird gar nicht erst als Ablauf geladen.
    expect(mockedGetAgenda).not.toHaveBeenCalledWith('cookie', 3);
  });

  it('cacht das Ergebnis (zweiter Aufruf löst keine neue ChurchTools-Abfrage aus)', async () => {
    mockedGetEvents.mockResolvedValue([
      { id: 1, startDate: '2026-07-05T09:00:00Z' },
    ] as unknown as EventsResult);
    mockedGetAgenda.mockResolvedValue(agendaWith(10));

    await getSongUsageMap('cookie');
    await getSongUsageMap('cookie');

    expect(mockedGetEvents).toHaveBeenCalledTimes(1);
  });
});

/**
 * #300: Der Statistik-Lauf hat das ChurchTools-Limit gerissen und danach die ganze App lahmgelegt.
 *
 * Belegt im Betriebs-Log: `getSongUsageMap` feuerte ~250 Agenda-Abrufe in einem Zug, ChurchTools
 * antwortete mit **429**, und danach bekamen auch Anmeldung (`whoami`), Rechte (`permissions/global`)
 * und das CSRF-Token beim Speichern 429. Die Symptome reichten von „CSRF-Token konnte nicht geholt
 * werden" bis zum Login-Screen mitten in der Arbeit.
 *
 * Vier Mechanismen, jeder mit eigener Gegenprobe:
 *  1. **Notbremse** – beim ersten 429/Timeout aufhören, statt ~240 weitere Anfragen zu schicken.
 *  2. **Bündelung** – fünf iPads gleichzeitig lösen EINEN Lauf aus, nicht fünf.
 *  3. **Präzise Invalidierung** – nur ein Termin, der beigetragen hat, darf den Stand wegwerfen.
 *  4. **Teilergebnis-Regel** – ein im Sturm entstandener Stand wird nie als Wahrheit gespeichert.
 */
// Nur die Felder, die die Statistik liest. Der Cast steckt hier EINMAL, damit die Testfälle darunter
// ohne Attrappen-Rauschen lesbar bleiben.
const ev = (id: number, tag = '2026-07-05') =>
  ({ id, startDate: `${tag}T09:00:00Z` }) as unknown as EventsResult[number];

describe('Notbremse bei Drosselung (#300)', () => {
  it('bricht beim ersten 429 ab, statt alle Termine abzuklappern', async () => {
    mockedGetEvents.mockResolvedValue(Array.from({ length: 20 }, (_, i) => ev(i + 1)));
    let n = 0;
    mockedGetAgenda.mockImplementation(async () => {
      n++;
      if (n === 3) throw new CtOverloadedError(1000);
      return agendaWith(10);
    });

    // Kein vollständiger Stand vorhanden → ehrlicher Fehler statt falscher Zahlen.
    await expect(getSongUsageMap('cookie')).rejects.toMatchObject({ status: 503 });

    // Nicht auf eine exakte Zahl festnageln: wie viele der 8 laufenden noch durchgehen, hängt an der
    // Reihenfolge der Microtasks. Entscheidend ist, dass NICHT alle 20 abgefragt wurden.
    expect(n).toBeLessThan(20);
  });

  it('eine Zeitüberschreitung bremst genauso (sie läuft nicht über CtOverloadedError)', async () => {
    // `ctGet` liegt nicht auf `asGatewayError` – ein Timeout fliegt dort als rohe TimeoutError heraus.
    // Von Hand gebaut, weil `AbortSignal.timeout` mit Fake-Timern nicht steuerbar ist.
    mockedGetEvents.mockResolvedValue(Array.from({ length: 20 }, (_, i) => ev(i + 1)));
    let n = 0;
    mockedGetAgenda.mockImplementation(async () => {
      n++;
      if (n === 3) {
        const e = new Error('The operation was aborted due to timeout');
        e.name = 'TimeoutError';
        throw e;
      }
      return agendaWith(10);
    });

    await expect(getSongUsageMap('cookie')).rejects.toMatchObject({ status: 503 });
    expect(n).toBeLessThan(20);
  });

  it('ein einzelner 500er bricht den Lauf NICHT ab (sonst blockiert ein kaputter Termin für immer)', async () => {
    mockedGetEvents.mockResolvedValue([ev(1), ev(2), ev(3)]);
    mockedGetAgenda.mockImplementation(async (_c: string, id: number) => {
      if (id === 2) throw new HttpError(502, 'ChurchTools-Fehler (500).');
      return agendaWith(10);
    });

    const usage = await getSongUsageMap('cookie');
    expect(usage[10].dates).toHaveLength(2); // Termin 1 und 3 sind drin
    expect(mockedGetAgenda).toHaveBeenCalledTimes(3);
  });
});

describe('Bündelung gleichzeitiger Läufe (#300)', () => {
  it('fünf gleichzeitige Anfragen lösen EINEN Lauf aus', async () => {
    mockedGetEvents.mockResolvedValue([ev(1)]);
    mockedGetAgenda.mockResolvedValue(agendaWith(10));

    const alle = await Promise.all(Array.from({ length: 5 }, () => getSongUsageMap('cookie')));

    expect(mockedGetEvents).toHaveBeenCalledTimes(1); // ← der eigentliche Zweck
    for (const u of alle) expect(u[10].dates).toEqual(['2026-07-05']);
  });
});

describe('Präzise Invalidierung (#300)', () => {
  async function standAus(...ids: number[]) {
    mockedGetEvents.mockResolvedValue(ids.map((i) => ev(i)));
    mockedGetAgenda.mockResolvedValue(agendaWith(10));
    await getSongUsageMap('cookie');
    mockedGetEvents.mockClear();
  }

  it('ein Termin, der NICHT beigetragen hat, wirft den Stand nicht weg', async () => {
    // Der Alltagsfall: Der nächste Sonntag ist ein Zukunftstermin und nie im Stand enthalten.
    // Vorher entwertete genau das die Statistik und löste einen ~250-Anfragen-Lauf aus.
    await standAus(1, 2);
    invalidateSongUsageCache(999);
    await getSongUsageMap('cookie');
    expect(mockedGetEvents).not.toHaveBeenCalled();
  });

  it('ein Termin, der beigetragen hat, wirft den Stand weg', async () => {
    // Gegenrichtung – bewacht, dass wir nicht zu viel wegsparen.
    await standAus(1, 2);
    invalidateSongUsageCache(2);
    await getSongUsageMap('cookie');
    expect(mockedGetEvents).toHaveBeenCalledTimes(1);
  });

  it('ohne Angabe wird alles geleert (Notausgang, u. a. für Tests)', async () => {
    await standAus(1, 2);
    invalidateSongUsageCache();
    await getSongUsageMap('cookie');
    expect(mockedGetEvents).toHaveBeenCalledTimes(1);
  });
});

describe('Teilergebnis wird nicht zur Wahrheit (#300)', () => {
  it('ein vollständiger Stand bleibt erhalten, wenn ein neuer Lauf gedrosselt wird', async () => {
    mockedGetEvents.mockResolvedValue([ev(1), ev(2)]);
    mockedGetAgenda.mockResolvedValue(agendaWith(10));
    const gut = await getSongUsageMap('cookie');
    expect(gut[10].dates).toHaveLength(2);

    invalidateSongUsageCache(1); // Stand verwerfen
    mockedGetAgenda.mockRejectedValue(new CtOverloadedError(1000));

    // Der abgebrochene Lauf darf den alten, vollständigen Stand nicht durch ein Rumpfergebnis ersetzen.
    const danach = await getSongUsageMap('cookie');
    expect(danach[10].dates).toHaveLength(2);
  });

  it('Sperrfrist: nach einer Drosselung wird nicht sofort erneut gefragt', async () => {
    mockedGetEvents.mockResolvedValue([ev(1)]);
    mockedGetAgenda.mockRejectedValue(new CtOverloadedError(1000));
    await expect(getSongUsageMap('cookie')).rejects.toMatchObject({ status: 503 });
    mockedGetEvents.mockClear();

    // Direkt danach: kein neuer Versuch – sonst rennt jeder Aufruf in die Wand und verlängert sie.
    await expect(getSongUsageMap('cookie')).rejects.toMatchObject({ status: 503 });
    expect(mockedGetEvents).not.toHaveBeenCalled();

    // Nach Ablauf der Sperrfrist darf es wieder losgehen.
    vi.advanceTimersByTime(130_000);
    mockedGetAgenda.mockResolvedValue(agendaWith(10));
    await getSongUsageMap('cookie');
    expect(mockedGetEvents).toHaveBeenCalledTimes(1);
  });

  it('auch ein gedrosselter Termin-Abruf am Anfang löst die Sperrfrist aus', async () => {
    // Der EINE getEvents-Aufruf ist der häufigste 429-Kandidat – er kommt vor allen Agenda-Abrufen.
    mockedGetEvents.mockRejectedValue(new CtOverloadedError(1000));
    await expect(getSongUsageMap('cookie')).rejects.toMatchObject({ status: 503 });
    mockedGetEvents.mockClear();

    await expect(getSongUsageMap('cookie')).rejects.toMatchObject({ status: 503 });
    expect(mockedGetEvents).not.toHaveBeenCalled();
  });
});

/**
 * #300, Nachtrag aus dem ERSTEN Betriebslauf: `[songUsage] Lauf beendet: 48 Termine, 175 übersprungen,
 * vollständig=false`.
 *
 * Die 175 waren keine Fehler, sondern Termine **ganz ohne Ablaufplan** (404) – im 4-Jahres-Fenster der
 * Normalfall (Gebetstreffen, Sitzungen, alles ohne Lieder). Sie als „übersprungen" zu zählen, ließ
 * dauerhaft `vollständig=false` im Log stehen. Eine Warnung, die immer leuchtet, wird ignoriert – und
 * sie sollte später einmal das „Statistik unvollständig"-Signal in der Oberfläche speisen.
 */
describe('404 ist kein Mangel, sondern der Normalfall (#300)', () => {
  /** Die Abschluss-Zeile des Laufs herausfischen – sie ist das einzige Beobachtbare. */
  function laufZeile(spy: ReturnType<typeof vi.spyOn>): string {
    const call = spy.mock.calls.find((c) => String(c[0]).includes('[songUsage] Lauf beendet'));
    return String(call?.[0] ?? '');
  }

  it('Termine ohne Ablaufplan zählen NICHT als fehlerhaft', async () => {
    // Erster Betriebslauf meldete "48 Termine, 175 übersprungen, vollständig=false". Die 175 waren
    // Termine ohne Ablauf – der Normalfall. Eine Warnung, die immer leuchtet, wird ignoriert.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedGetEvents.mockResolvedValue([ev(1), ev(2), ev(3)]);
    mockedGetAgenda.mockImplementation(async (_c: string, id: number) => {
      if (id !== 1) throw new HttpError(404, 'Kein Ablaufplan.');
      return agendaWith(10);
    });

    const usage = await getSongUsageMap('cookie');
    expect(usage[10].dates).toHaveLength(1);

    const zeile = laufZeile(warn);
    expect(zeile).toContain('2 ohne (normal)');
    expect(zeile).toContain('0 fehlerhaft');
    expect(zeile).toContain('vollständig=true');
  });

  it('ein ECHTER Fehler (403) zählt weiterhin als fehlerhaft', async () => {
    // Gegenrichtung – die Unterscheidung muss in beide Richtungen greifen.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedGetEvents.mockResolvedValue([ev(1), ev(2)]);
    mockedGetAgenda.mockImplementation(async (_c: string, id: number) => {
      if (id === 2) throw new HttpError(403, 'Kein Zugriff.');
      return agendaWith(10);
    });

    await getSongUsageMap('cookie');

    const zeile = laufZeile(warn);
    expect(zeile).toContain('1 fehlerhaft');
    expect(zeile).toContain('vollständig=false');
    expect(mockedGetAgenda).toHaveBeenCalledTimes(2); // beide versucht, kein Abbruch
  });
});
