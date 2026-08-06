import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAppointmentSubtitle, __clearSubtitleMemo } from './churchtools.js';

/**
 * #306: Der Untertitel-Abruf war die HÄLFTE der Dauerlast der Terminliste.
 *
 * `getServicesWithSetlists` holt je Termin zwei Dinge – den Ablauf UND den Untertitel. Bei ~8 Terminen
 * sind das 1 + 2×8 = 17 ChurchTools-Anfragen, **alle 60 Sekunden, pro Gerät**. Bei fünf Geräten im
 * Gottesdienst ist das die größte Dauerlast der App (~180 Anfragen/Minute) – deutlich mehr als der
 * Statistik-Burst, der zu #300 führte.
 *
 * Ein Termin-Untertitel ändert sich praktisch nie. Zehn Minuten Vorhaltezeit halbieren die Last.
 */
function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  __clearSubtitleMemo();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('getAppointmentSubtitle – Memo (#306)', () => {
  it('holt den Untertitel einmal und merkt ihn sich', async () => {
    const f = vi.fn().mockResolvedValue(jsonRes({ data: { subtitle: 'Kennenlernabend' } }));
    vi.stubGlobal('fetch', f);

    expect(await getAppointmentSubtitle('cookie', '1', 42, 'u7')).toBe('Kennenlernabend');
    expect(await getAppointmentSubtitle('cookie', '1', 42, 'u7')).toBe('Kennenlernabend');
    expect(f).toHaveBeenCalledTimes(1); // ← der eigentliche Zweck
  });

  it('merkt sich AUCH „kein Untertitel" – das ist der häufigste Fall', async () => {
    // Ohne diesen Punkt spart das Memo praktisch nichts: Die meisten Termine haben keinen Untertitel,
    // und ein nicht gemerktes `null` würde bei jedem 60-Sekunden-Poll neu geholt.
    const f = vi.fn().mockResolvedValue(jsonRes({ data: {} }));
    vi.stubGlobal('fetch', f);

    expect(await getAppointmentSubtitle('cookie', '1', 42, 'u7')).toBeNull();
    expect(await getAppointmentSubtitle('cookie', '1', 42, 'u7')).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('nach zehn Minuten wird wieder frisch geholt', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ data: { subtitle: 'alt' } }))
      .mockResolvedValueOnce(jsonRes({ data: { subtitle: 'neu' } }));
    vi.stubGlobal('fetch', f);

    expect(await getAppointmentSubtitle('cookie', '1', 42, 'u7')).toBe('alt');
    await vi.advanceTimersByTimeAsync(10 * 60_000 + 1000);
    expect(await getAppointmentSubtitle('cookie', '1', 42, 'u7')).toBe('neu');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('verschiedene Konten teilen sich den Eintrag NICHT (#199)', async () => {
    // Kalender-Sichtbarkeiten unterscheiden sich je Konto. Ein geteilter Schlüssel hätte schon einmal
    // Nichtberechtigten fremde Daten geliefert – genau deshalb ist die Konto-Kennung im Schlüssel.
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ data: { subtitle: 'für Anna' } }))
      .mockResolvedValueOnce(jsonRes({ data: { subtitle: 'für Bert' } }));
    vi.stubGlobal('fetch', f);

    expect(await getAppointmentSubtitle('cookie-a', '1', 42, 'u7')).toBe('für Anna');
    expect(await getAppointmentSubtitle('cookie-b', '1', 42, 'u8')).toBe('für Bert');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('verschiedene Termine bekommen eigene Einträge', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ data: { subtitle: 'A' } }))
      .mockResolvedValueOnce(jsonRes({ data: { subtitle: 'B' } }));
    vi.stubGlobal('fetch', f);

    expect(await getAppointmentSubtitle('cookie', '1', 42, 'u7')).toBe('A');
    expect(await getAppointmentSubtitle('cookie', '1', 43, 'u7')).toBe('B');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('ein FEHLER wird nicht gemerkt – sonst hielte ein Aussetzer zehn Minuten', async () => {
    // „Vorübergehend ist nicht ungültig": Ein einzelner Fehlschlag darf den Untertitel nicht zehn
    // Minuten lang fälschlich auf „keiner" festnageln.
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ message: 'weg' }, 500))
      .mockResolvedValueOnce(jsonRes({ data: { subtitle: 'da' } }));
    vi.stubGlobal('fetch', f);

    expect(await getAppointmentSubtitle('cookie', '1', 42, 'u7')).toBeNull();
    expect(await getAppointmentSubtitle('cookie', '1', 42, 'u7')).toBe('da');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('leerer Untertitel gilt als keiner (und wird gemerkt)', async () => {
    const f = vi.fn().mockResolvedValue(jsonRes({ data: { subtitle: '   ' } }));
    vi.stubGlobal('fetch', f);

    expect(await getAppointmentSubtitle('cookie', '1', 42, 'u7')).toBeNull();
    expect(await getAppointmentSubtitle('cookie', '1', 42, 'u7')).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });
});
