import { describe, it, expect, vi, beforeEach } from 'vitest';

// ChurchTools-Modul mocken: getAgendaItems soll OHNE echtes ChurchTools getestet werden.
vi.mock('./churchtools.js', () => ({
  getAgenda: vi.fn(),
}));

import { getAgendaItems, agendaItemSignature } from './setlistBuilder.js';
import { getAgenda, type CtAgendaItem } from './churchtools.js';

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

describe('getAgendaItems – Änderungs-Diff (#161/#178)', () => {
  // Roh-Punkt wie aus ChurchTools (ohne Lied → buildSong wird nicht angefasst).
  const raw = (id: number, title: string): CtAgendaItem =>
    ({ id, title, type: 'normal', duration: 0, startTimes: { '1500': null } }) as CtAgendaItem;
  const sigOf = (id: number, title: string) => ({
    id,
    sig: agendaItemSignature(raw(id, title)),
    title,
  });

  it('liefert für einen gelöschten Punkt einen removed-Platzhalter an der alten Position', async () => {
    // Basislinie: A(1), B(2), C(3) – aktuell wurde B gelöscht.
    mockedGetAgenda.mockResolvedValue({
      items: [raw(1, 'A'), raw(3, 'C')],
    } as unknown as AgendaResult);

    const items = await getAgendaItems('cookie', EVENT, [
      sigOf(1, 'A'),
      sigOf(2, 'B'),
      sigOf(3, 'C'),
    ]);

    expect(items.map((i) => i.id)).toEqual([1, 2, 3]); // Platzhalter B zwischen A und C
    const placeholder = items[1];
    expect(placeholder.removed).toBe(true);
    expect(placeholder.title).toBe('B');
    // Unveränderte Punkte werden nicht markiert.
    expect(items[0].changed).toBeFalsy();
    expect(items[2].changed).toBeFalsy();
  });

  it('markiert einen inhaltlich geänderten Punkt als changed', async () => {
    mockedGetAgenda.mockResolvedValue({
      items: [raw(1, 'A neu'), raw(2, 'B')],
    } as unknown as AgendaResult);

    const items = await getAgendaItems('cookie', EVENT, [sigOf(1, 'A'), sigOf(2, 'B')]);
    expect(items[0].changed).toBe(true);
    expect(items[1].changed).toBeFalsy();
    expect(items.some((i) => i.removed)).toBe(false);
  });
});
