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
const loeschen = vi.fn();
vi.mock('../hooks/useAvailability', () => ({
  useMyAbsences: () => absences(),
  useAbsenceEvents: () => events(),
  useCreateAbsence: () => ({ mutate: anlegen, isPending: false }),
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

function zeige(online = true) {
  const onToast = vi.fn();
  render(<Availability online={online} onToast={onToast} />);
  return { onToast };
}

describe('Availability – Terminzeilen', () => {
  it('frei → „Kann nicht"; eigene → „Abgemeldet"; manuell → Schloss ohne Knopf', () => {
    zeige();
    expect(screen.getAllByRole('button', { name: 'Kann nicht' })).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: /Abmeldung für Gottesdienst am So, 11.10. zurücknehmen/ }),
    ).not.toBeNull();
    // Der Jugendabend fällt in den manuellen Urlaub: kein Knopf, nur das Schloss.
    expect(screen.getByTitle('In ChurchTools eingetragen')).not.toBeNull();
  });

  it('„Kann nicht" öffnet das Formular für genau diesen Tag und trägt ihn ein', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Kann nicht' }));
    expect(screen.getByText(/So, 04.10. – du wirst als abwesend eingetragen/)).not.toBeNull();
    fireEvent.change(screen.getByLabelText('Kommentar (optional)'), {
      target: { value: 'Dienstreise' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Eintragen' }));
    expect(anlegen).toHaveBeenCalledWith(
      { startDate: '2026-10-04', endDate: '2026-10-04', comment: 'Dienstreise' },
      expect.anything(),
    );
  });

  it('„Abgemeldet" nimmt die eigene Abwesenheit zurück', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /zurücknehmen/ }));
    expect(loeschen).toHaveBeenCalledWith(10, expect.anything());
  });
});

describe('Availability – eigene Liste', () => {
  it('eigene Einträge haben einen Papierkorb, manuelle ein Schloss', () => {
    zeige();
    expect(screen.getByRole('button', { name: /Abwesenheit So, 11.10. löschen/ })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Abwesenheit Mi, 14.10./ })).toBeNull();
    expect(screen.getByTitle('Nur in ChurchTools änderbar')).not.toBeNull();
  });

  it('„Zeitraum" verlangt ein Ende nach dem Anfang', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Zeitraum/ }));
    fireEvent.change(screen.getByLabelText('Von'), { target: { value: '2026-12-10' } });
    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2026-12-01' } });
    expect(screen.getByText('Das Ende liegt vor dem Anfang.')).not.toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Eintragen' }).disabled).toBe(
      true,
    );
    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2026-12-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eintragen' }));
    expect(anlegen).toHaveBeenCalledWith(
      { startDate: '2026-12-10', endDate: '2026-12-20', comment: undefined },
      expect.anything(),
    );
  });

  it('offline sind Eintragen und Löschen gesperrt', () => {
    zeige(false);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Kann nicht' }).disabled).toBe(
      true,
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /Zeitraum/ }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /löschen/ }).disabled).toBe(true);
  });
});

/**
 * Variante C (05.09.2026): der Wochenstreifen. „Heute" ist hier fest (Mo 05.10.2026), damit die
 * Woche 5.–11. Oktober gezeigt wird – mit dem Gottesdienst am 11. (abgemeldet) und dem Start des
 * manuellen Urlaubs. Die Tests prüfen die Bedienung: blättern, zwei Tipps = Zeitraum, Leiste, Blatt.
 */
describe('Availability – Wochenstreifen (Variante C)', () => {
  const HEUTE = '2026-10-05';
  function zeigeWoche(online = true) {
    render(<Availability online={online} onToast={vi.fn()} heute={HEUTE} />);
  }

  it('zeigt die Woche von heute mit Beschriftung und den Zuständen der Tage', () => {
    zeigeWoche();
    expect(screen.getByText('5. – 11. Oktober')).not.toBeNull();
    // So 11.: Termin UND selbst abgemeldet – beides steht im Namen der Kachel.
    expect(screen.getByRole('button', { name: 'So 11., Termin, abgemeldet' })).not.toBeNull();
    // „Diese Woche" listet den Gottesdienst genau einmal, mit „Abgemeldet".
    expect(screen.getAllByRole('button', { name: /zurücknehmen/ })).toHaveLength(1);
  });

  it('blättert mit dem Pfeil eine Woche weiter – dort liegt der manuelle Urlaub (grau, gesperrt)', () => {
    zeigeWoche();
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Woche' }));
    expect(screen.getByText('12. – 18. Oktober')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Fr 16., Termin, in ChurchTools eingetragen' }),
    ).not.toBeNull();
    // Der Jugendabend fällt in den Urlaub: in „In dieser Woche" nur das Schloss, kein Knopf.
    expect(screen.getByTitle('In ChurchTools eingetragen')).not.toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Vorige Woche' }).disabled).toBe(
      false,
    );
  });

  it('zwei Tipps wählen einen Zeitraum, die Leiste zählt die Tage, „Eintragen" belegt das Blatt vor', () => {
    zeigeWoche();
    fireEvent.click(screen.getByRole('button', { name: 'Di 6.' }));
    expect(screen.getByText('Endtag antippen – oder nur diesen Tag eintragen')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fr 9.' }));
    expect(screen.getByText('4 Tage gewählt')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Eintragen' }));
    expect(screen.getByLabelText<HTMLInputElement>('Von').value).toBe('2026-10-06');
    expect(screen.getByLabelText<HTMLInputElement>('Bis').value).toBe('2026-10-09');
    fireEvent.click(screen.getAllByRole('button', { name: 'Eintragen' }).at(-1)!);
    expect(anlegen).toHaveBeenCalledWith(
      { startDate: '2026-10-06', endDate: '2026-10-09', comment: undefined },
      expect.anything(),
    );
  });

  it('verkehrte Reihenfolge wird getauscht, ein Tipp auf den Anfang hebt die Auswahl auf', () => {
    zeigeWoche();
    fireEvent.click(screen.getByRole('button', { name: 'Fr 9.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Di 6.' }));
    expect(screen.getByText('4 Tage gewählt')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByText('4 Tage gewählt')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mi 7.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mi 7., gewählt' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('vergangene Tage lassen sich nicht antippen', () => {
    render(<Availability online onToast={vi.fn()} heute="2026-10-07" />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Mo 5.' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Mi 7.' }).disabled).toBe(false);
  });
});
