// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Absence, AbsenceEvent } from '@shared/types/index';

/**
 * #177 Verfügbarkeit – die Bedienung, nicht die Daten:
 *  - ein freier Termin bietet „Kann nicht", ein eigener Eintrag „Abgemeldet" (zurücknehmen),
 *  - ein manueller ChurchTools-Eintrag zeigt das Schloss und KEINEN Knopf,
 *  - „Kann nicht" trägt genau diesen Tag ein, mit Marker-freiem Kommentar (der Marker ist Serversache),
 *  - offline sind die Schreibknöpfe gesperrt.
 */
const absences = vi.fn();
const events = vi.fn();
const anlegen = vi.fn();
const aendern = vi.fn();
const loeschen = vi.fn();
vi.mock('../hooks/useAvailability', () => ({
  useMyAbsences: () => absences(),
  useAbsenceEvents: () => events(),
  useCreateAbsence: () => ({ mutate: anlegen, isPending: false }),
  useUpdateAbsence: () => ({ mutate: aendern, isPending: false }),
  useDeleteAbsence: () => ({ mutate: loeschen, isPending: false }),
}));
vi.mock('../components/Coachmarks', () => ({ Coachmarks: () => null }));
vi.mock('../utils/onboarding', async () => {
  const echt = await vi.importActual<typeof import('../utils/onboarding')>('../utils/onboarding');
  return { ...echt, isTourDone: () => true };
});

const { Availability } = await import('./Availability');

const EVENTS: AbsenceEvent[] = [
  { id: 1, name: 'Gottesdienst', date: '2026-10-04', startDate: '2026-10-04T10:00:00Z' },
  { id: 2, name: 'Gottesdienst', date: '2026-10-11', startDate: '2026-10-11T10:00:00Z' },
  { id: 3, name: 'Jugendabend', date: '2026-10-16', startDate: '2026-10-16T18:00:00Z' },
];
const EIGENE: Absence = {
  id: 10,
  startDate: '2026-10-11',
  endDate: '2026-10-11',
  comment: 'Reise',
  reason: null,
  eigene: true,
};
const MANUELL: Absence = {
  id: 11,
  startDate: '2026-10-14',
  endDate: '2026-10-20',
  comment: '',
  reason: 'Urlaub',
  eigene: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  absences.mockReturnValue({
    data: [EIGENE, MANUELL],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  events.mockReturnValue({ data: EVENTS, isLoading: false, isError: false, refetch: vi.fn() });
});

const HEUTE = '2026-10-05'; // Montag; die Woche 5.–11.10. zeigt den Gottesdienst am 11.

function zeige(online = true, heute = HEUTE) {
  const onToast = vi.fn();
  render(<Availability online={online} onToast={onToast} heute={heute} />);
  return { onToast };
}

describe('Availability – Statuskopf (05.09.2026)', () => {
  it('nennt den nächsten Termin und dass man verfügbar ist – mit „Kann nicht" daneben', () => {
    // Ein „heute" VOR dem 04.10.: Dieser Termin ist frei, also sagt der Kopf „verfügbar".
    zeige(true, '2026-10-01');
    expect(screen.getByText(/Gottesdienst – du bist verfügbar/)).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Kann nicht' }).length).toBeGreaterThan(0);
  });

  it('ist man abgemeldet, sagt der Kopf das und bietet das Zurücknehmen an', () => {
    zeige();
    expect(screen.getByText(/du bist abgemeldet/)).not.toBeNull();
    fireEvent.click(
      screen.getAllByRole('button', { name: /Abmeldung für Gottesdienst am So, 11.10./ })[0],
    );
    expect(loeschen).toHaveBeenCalledWith(10, expect.anything());
  });
});

describe('Availability – Terminzeilen', () => {
  it('frei → „Kann nicht"; eigene → „Abgemeldet"; manuell → Schloss ohne Knopf', () => {
    zeige();
    // Der 11.10. ist selbst abgemeldet (Kopf + Zeile), der Jugendabend am 16.10. liegt im manuellen
    // Urlaub. Frei ist in dieser Woche nichts – deshalb eine Woche weiter blättern.
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Woche' }));
    expect(screen.getByTitle('In ChurchTools eingetragen')).not.toBeNull();
  });

  it('„Kann nicht" öffnet das Fenster für genau diesen Tag und trägt ihn ein', () => {
    zeige(true, '2026-10-01');
    fireEvent.click(screen.getAllByRole('button', { name: 'Kann nicht' })[0]);
    expect(screen.getByLabelText<HTMLInputElement>('Von').value).toBe('2026-10-04');
    fireEvent.change(screen.getByLabelText('Kommentar (optional)'), {
      target: { value: 'Dienstreise' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Eintragen' }));
    expect(anlegen).toHaveBeenCalledWith(
      { startDate: '2026-10-04', endDate: '2026-10-04', comment: 'Dienstreise' },
      expect.anything(),
    );
  });
});

describe('Availability – eigene Einträge ändern (05.09.2026)', () => {
  it('ein Tipp auf die Zeile öffnet „Abwesenheit ändern" mit ihren Werten', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Abwesenheit So, 11.10. ändern/ }));
    expect(screen.getByLabelText<HTMLInputElement>('Von').value).toBe('2026-10-11');
    expect(screen.getByLabelText<HTMLInputElement>('Kommentar (optional)').value).toBe('Reise');
    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2026-10-13' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(aendern).toHaveBeenCalledWith(
      { id: 10, neu: { startDate: '2026-10-11', endDate: '2026-10-13', comment: 'Reise' } },
      expect.anything(),
    );
  });

  it('im selben Fenster lässt sich der Eintrag löschen', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Abwesenheit So, 11.10. ändern/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(loeschen).toHaveBeenCalledWith(10, expect.anything());
  });

  it('manuelle ChurchTools-Einträge sind KEIN Knopf – sie tragen ein Schloss', () => {
    zeige();
    expect(screen.queryByRole('button', { name: /Abwesenheit Mi, 14.10./ })).toBeNull();
    expect(screen.getByTitle('Nur in ChurchTools änderbar')).not.toBeNull();
  });

  it('offline sind Eintragen und Ändern gesperrt', () => {
    zeige(false);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Abwesenheit eintragen' }).disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /Abwesenheit So, 11.10. ändern/ })
        .disabled,
    ).toBe(true);
  });
});

describe('Availability – Wochenstreifen', () => {
  it('zeigt die Woche von heute mit Beschriftung und den Zuständen der Tage', () => {
    zeige();
    expect(screen.getByText('5. – 11. Oktober')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'So 11., Termin, abgemeldet' })).not.toBeNull();
  });

  it('blättert mit dem Pfeil eine Woche weiter – dort liegt der manuelle Urlaub (grau, gesperrt)', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Woche' }));
    expect(screen.getByText('12. – 18. Oktober')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Fr 16., Termin, in ChurchTools eingetragen' }),
    ).not.toBeNull();
  });

  it('ein Tipp auf einen Tag öffnet das Fenster mit diesem Tag – kein zweiter Tipp nötig', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Di 6.' }));
    expect(screen.getByLabelText<HTMLInputElement>('Von').value).toBe('2026-10-06');
    fireEvent.click(screen.getByRole('button', { name: 'Wochenende' }));
    expect(screen.getByLabelText<HTMLInputElement>('Von').value).toBe('2026-10-10');
    expect(screen.getByLabelText<HTMLInputElement>('Bis').value).toBe('2026-10-11');
  });

  it('vergangene Tage lassen sich nicht antippen', () => {
    zeige(true, '2026-10-07');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Mo 5.' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Mi 7.' }).disabled).toBe(false);
  });
});
