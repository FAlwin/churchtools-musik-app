import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ChurchTools mocken – Nutzungsstatistik ohne echtes ChurchTools testen.
vi.mock('./churchtools.js', () => ({
  getEvents: vi.fn(),
  getAgenda: vi.fn(),
}));

import { getSongUsageMap, invalidateSongUsageCache } from './setlistBuilder.js';
import { getEvents, getAgenda } from './churchtools.js';

const mockedGetEvents = vi.mocked(getEvents);
const mockedGetAgenda = vi.mocked(getAgenda);
type EventsResult = Awaited<ReturnType<typeof getEvents>>;
type AgendaResult = Awaited<ReturnType<typeof getAgenda>>;

const agendaWith = (...songIds: number[]) =>
  ({ items: songIds.map((songId, i) => ({ id: i + 1, song: { songId } })) }) as unknown as AgendaResult;

beforeEach(() => {
  invalidateSongUsageCache(); // 1-h-Cache zwischen Tests leeren
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
