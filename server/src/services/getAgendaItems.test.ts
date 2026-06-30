import { describe, it, expect, vi, beforeEach } from 'vitest';

// ChurchTools-Modul mocken: getAgendaItems soll OHNE echtes ChurchTools getestet werden.
vi.mock('./churchtools.js', () => ({
  getAgenda: vi.fn(),
}));

import { getAgendaItems } from './setlistBuilder.js';
import { getAgenda } from './churchtools.js';

const mockedGetAgenda = vi.mocked(getAgenda);
const EVENT = 1500;
type AgendaResult = Awaited<ReturnType<typeof getAgenda>>;

beforeEach(() => mockedGetAgenda.mockReset());

describe('getAgendaItems – Uhrzeit & Ablauf-Mapping', () => {
  it('zeigt die Uhrzeit aus startTimes[eventId] (Berlin) und rechnet die Dauer in Minuten', async () => {
    mockedGetAgenda.mockResolvedValue({
      items: [
        {
          id: 1,
          title: 'Begrüßung',
          type: 'normal',
          duration: 300,
          start: '2026-06-30T09:00:00Z',
          startTimes: { '1500': '2026-06-30T09:00:00Z' },
        },
      ],
    } as unknown as AgendaResult);

    const items = await getAgendaItems('cookie', EVENT);
    expect(items[0].time).toBe('11:00'); // CEST = UTC+2
    expect(items[0].durationMin).toBe(5);
    expect(items[0].isHeader).toBe(false);
  });

  it('blendet die Uhrzeit aus, wenn startTimes[eventId] null ist (das CT-„Auge")', async () => {
    mockedGetAgenda.mockResolvedValue({
      items: [
        {
          id: 2,
          title: 'Soundcheck',
          type: 'normal',
          duration: 0,
          start: '2026-06-30T08:30:00Z', // start bleibt gefüllt – darf NICHT verwendet werden
          startTimes: { '1500': null },
        },
      ],
    } as unknown as AgendaResult);

    const items = await getAgendaItems('cookie', EVENT);
    expect(items[0].time).toBeNull();
    expect(items[0].durationMin).toBeNull();
  });

  it('fällt auf start zurück, wenn startTimes fehlt, und erkennt Überschriften', async () => {
    mockedGetAgenda.mockResolvedValue({
      items: [{ id: 3, title: 'Teil 1', type: 'header', start: '2026-06-30T10:00:00Z' }],
    } as unknown as AgendaResult);

    const items = await getAgendaItems('cookie', EVENT);
    expect(items[0].isHeader).toBe(true);
    expect(items[0].time).toBe('12:00');
  });
});
