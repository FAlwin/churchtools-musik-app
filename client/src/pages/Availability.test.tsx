// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { Absence, AbsenceEvent } from '@shared/types/index';

/**
 * #177 Abwesenheiten – die Bedienung nach Entwurfsrunde 8 (19.09.2026), nicht die Daten:
 *  - ein Haken ist nur VORGEMERKT, erst „Speichern" schreibt – alle auf einmal (Alwin + Frau),
 *  - ein zweiter Tipp nimmt den Haken zurück, „Verwerfen" alles,
 *  - ein Termin in einem Zeitraum fragt nach (löschen vormerken oder anpassen), statt still zu löschen,
 *  - die Monatsleiste zeigt nur den gewählten Monat, „Heute" führt zurück,
 *  - „Einträge" listet Anstehendes und Früheres, Vergangenes nur zum Ansehen,
 *  - offline sind die Kästchen und das Plus gesperrt.
 */
const absences = vi.fn();
const events = vi.fn();
const anlegen = vi.fn();
const aendern = vi.fn();
const loeschen = vi.fn();
const sichern = vi.fn();
vi.mock('../hooks/useAvailability', () => ({
  useMyAbsences: () => absences(),
  useAbsenceEvents: () => events(),
  useAbsenceReasons: () => ({ data: GRUENDE }),
  useCreateAbsence: () => ({ mutate: anlegen, isPending: false }),
  useUpdateAbsence: () => ({ mutate: aendern, isPending: false }),
  useDeleteAbsence: () => ({ mutate: loeschen, isPending: false }),
  useSaveAbsenceChanges: () => ({ mutate: sichern, isPending: false }),
}));
vi.mock('../components/Coachmarks', () => ({ Coachmarks: () => null }));
vi.mock('../utils/onboarding', async () => {
  const echt = await vi.importActual<typeof import('../utils/onboarding')>('../utils/onboarding');
  return { ...echt, isTourDone: () => true };
});

const { Availability } = await import('./Availability');

/** Die Gründe, wie ChurchTools sie liefert – gemessen an der ECG-Instanz (05.09.2026). */
const GRUENDE = [
  { id: 3, name: 'Krank', standard: false },
  { id: 2, name: 'Urlaub', standard: false },
  { id: 1, name: 'Abwesend', standard: true },
];

const EVENTS: AbsenceEvent[] = [
  { id: 1, name: 'Gottesdienst', date: '2026-10-04', startDate: '2026-10-04T10:00:00Z' },
  { id: 2, name: 'Gottesdienst', date: '2026-10-11', startDate: '2026-10-11T10:00:00Z' },
  { id: 3, name: 'Jugendabend', date: '2026-10-16', startDate: '2026-10-16T18:00:00Z' },
  { id: 4, name: 'Gottesdienst', date: '2026-11-01', startDate: '2026-11-01T10:00:00Z' },
];
const EIGENE: Absence = {
  id: 10,
  startDate: '2026-10-11',
  endDate: '2026-10-11',
  comment: 'Reise',
  reason: 'Abwesend',
  reasonId: 1,
  vonApp: true,
};
const URLAUB: Absence = {
  id: 11,
  startDate: '2026-10-14',
  endDate: '2026-10-20',
  comment: 'Herbstferien',
  reason: 'Urlaub',
  reasonId: 2,
  vonApp: false,
};
const FRUEHER: Absence = {
  id: 12,
  startDate: '2026-07-20',
  endDate: '2026-08-03',
  comment: 'Sommer',
  reason: 'Urlaub',
  reasonId: 2,
  vonApp: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  absences.mockReturnValue({
    data: [EIGENE, URLAUB, FRUEHER],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  events.mockReturnValue({ data: EVENTS, isLoading: false, isError: false, refetch: vi.fn() });
});

const HEUTE = '2026-10-01';

function zeige(online = true, heute = HEUTE) {
  const onToast = vi.fn();
  render(<Availability online={online} onToast={onToast} heute={heute} />);
  return { onToast };
}

const kasten = (name: RegExp) => screen.getByRole<HTMLButtonElement>('button', { name });
const leiste = () => screen.queryByRole('status');

describe('Abwesenheiten – Kopf und Monat', () => {
  it('heißt „Abwesenheiten", hat den Schalter Termine | Einträge und zeigt den laufenden Monat', () => {
    zeige();
    expect(screen.getByText('Abwesenheiten')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Termine' })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Einträge/ })).not.toBeNull();
    expect(screen.getByText('Oktober 2026')).not.toBeNull();
    expect(screen.getByText('3 Termine')).not.toBeNull();
    expect(screen.queryByText('01.11.')).toBeNull(); // November gehört nicht in den Oktober
  });

  it('ein anderer Monat zeigt seine Termine, „Heute" führt zurück', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Nov 26' }));
    expect(screen.getByText('November 2026')).not.toBeNull();
    expect(screen.getByText('1 Termin')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Heute' }));
    expect(screen.getByText('Oktober 2026')).not.toBeNull();
  });

  it('ein Monat ohne Termine sagt das', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Dez 26' }));
    expect(screen.getByText('Kein Termin mehr in diesem Monat.')).not.toBeNull();
  });
});

describe('Abwesenheiten – Häkchen sind vorgemerkt, Speichern schreibt alle', () => {
  it('ein Haken zeigt die Leiste, schreibt aber noch nichts; Speichern trägt den Tag ein', () => {
    const { onToast } = zeige();
    expect(leiste()).toBeNull();
    const k = kasten(/Abwesend – Gottesdienst, So, 04\.10\./);
    expect(k.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(k);
    expect(k.getAttribute('aria-pressed')).toBe('true');
    expect(leiste()?.textContent).toContain('1 Änderung vorgemerkt');
    expect(sichern).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(sichern).toHaveBeenCalledTimes(1);
    expect(sichern.mock.calls[0][0]).toEqual({ eintragen: ['2026-10-04'], loeschen: [] });
    // Erfolg meldet die Zahl und räumt auf (der Rückruf kommt von außen → act)
    void act(() => sichern.mock.calls[0][1].onSuccess(1));
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('1 Änderung gespeichert'));
    expect(leiste()).toBeNull();
  });

  it('ein zweiter Tipp nimmt den Haken zurück – nichts bleibt vorgemerkt', () => {
    zeige();
    const k = kasten(/So, 04\.10\./);
    fireEvent.click(k);
    fireEvent.click(k);
    expect(k.getAttribute('aria-pressed')).toBe('false');
    expect(leiste()).toBeNull();
  });

  it('ein eigener Eintrag hat den Haken; ihn entfernen merkt das Löschen vor', () => {
    zeige();
    const k = kasten(/So, 11\.10\./);
    expect(k.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(k);
    expect(k.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(sichern.mock.calls[0][0]).toEqual({ eintragen: [], loeschen: [10] });
  });

  it('„Verwerfen" nimmt alles zurück', () => {
    zeige();
    fireEvent.click(kasten(/So, 04\.10\./));
    fireEvent.click(kasten(/So, 11\.10\./));
    expect(leiste()?.textContent).toContain('2 Änderungen vorgemerkt');
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(leiste()).toBeNull();
    expect(kasten(/So, 11\.10\./).getAttribute('aria-pressed')).toBe('true');
  });

  it('solange etwas vorgemerkt ist, gibt es kein Plus – ein Speichern-Weg', () => {
    zeige();
    expect(screen.getByRole('button', { name: 'Zeitraum eintragen' })).not.toBeNull();
    fireEvent.click(kasten(/So, 04\.10\./));
    expect(screen.queryByRole('button', { name: 'Zeitraum eintragen' })).toBeNull();
  });

  it('ein Fehler beim Speichern behält die Vormerkung – man kann es noch einmal versuchen', () => {
    const { onToast } = zeige();
    fireEvent.click(kasten(/So, 04\.10\./));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    void act(() => sichern.mock.calls[0][1].onError(new Error('429')));
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('Konnte nicht gespeichert'));
    expect(leiste()?.textContent).toContain('1 Änderung vorgemerkt');
  });
});

describe('Abwesenheiten – ein Termin in einem Zeitraum fragt nach', () => {
  it('der Haken sitzt, die Unterzeile nennt den Zeitraum, ein Tipp öffnet die Rückfrage', () => {
    zeige();
    const k = kasten(/Jugendabend, Fr, 16\.10\./);
    expect(k.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Urlaub · Mi, 14\.10\. – Di, 20\.10\./)).not.toBeNull();
    fireEvent.click(k);
    expect(screen.getByText('Teil eines Zeitraums')).not.toBeNull();
    expect(screen.getByText(/gehört zu/).textContent).toContain('Urlaub, Mi, 14.10. – Di, 20.10.');
    expect(leiste()).toBeNull(); // noch nichts vorgemerkt
  });

  it('„Zeitraum löschen" merkt den ganzen Zeitraum vor – Speichern löscht ihn', () => {
    zeige();
    fireEvent.click(kasten(/Jugendabend/));
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum löschen' }));
    expect(screen.queryByText('Teil eines Zeitraums')).toBeNull();
    expect(kasten(/Jugendabend/).getAttribute('aria-pressed')).toBe('false');
    expect(leiste()?.textContent).toContain('1 Änderung vorgemerkt');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(sichern.mock.calls[0][0]).toEqual({ eintragen: [], loeschen: [11] });
  });

  it('ein weiterer Tipp nimmt die vorgemerkte Löschung zurück – ohne neue Rückfrage', () => {
    zeige();
    fireEvent.click(kasten(/Jugendabend/));
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum löschen' }));
    fireEvent.click(kasten(/Jugendabend/));
    expect(screen.queryByText('Teil eines Zeitraums')).toBeNull();
    expect(kasten(/Jugendabend/).getAttribute('aria-pressed')).toBe('true');
    expect(leiste()).toBeNull();
  });

  it('„Zeitraum anpassen" öffnet das Fenster mit den Werten des Zeitraums', () => {
    zeige();
    fireEvent.click(kasten(/Jugendabend/));
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum anpassen' }));
    expect(screen.getByText('Abwesenheit ändern')).not.toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Von').value).toBe('2026-10-14');
    expect(screen.getByLabelText<HTMLInputElement>('Bis').value).toBe('2026-10-20');
    expect(leiste()).toBeNull();
  });
});

describe('Abwesenheiten – Seite „Einträge"', () => {
  it('zeigt Anstehendes nach Monat, mit den Terminen, die ein Eintrag trifft', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Einträge/ }));
    expect(screen.getByRole('button', { name: 'Anstehend (2)' })).not.toBeNull();
    expect(screen.getByText('Oktober 2026')).not.toBeNull();
    const urlaub = screen.getByRole('button', {
      name: /Abwesenheit Mi, 14\.10\. – Di, 20\.10\. ändern/,
    });
    expect(urlaub.textContent).toContain('trifft Fr, 16.10.');
    expect(urlaub.textContent).toContain('in ChurchTools eingetragen');
    expect(screen.queryByText(/Sommer/)).toBeNull();
  });

  it('„Früher" listet Vergangenes – ein Tipp zeigt es nur zum Ansehen', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Einträge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Früher (1)' }));
    expect(screen.getByText('Juli 2026')).not.toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: /Abwesenheit .*20\.07\. – .*03\.08\. ansehen/ }),
    );
    expect(screen.getByText('Vergangene Abwesenheit')).not.toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Von').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();
  });

  it('ein anstehender Eintrag öffnet „Abwesenheit ändern" und lässt sich löschen', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Einträge/ }));
    fireEvent.click(screen.getByRole('button', { name: /Abwesenheit So, 11\.10\. ändern/ }));
    expect(screen.getByText('Abwesenheit ändern')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(loeschen).toHaveBeenCalledWith(10, expect.anything());
  });
});

describe('Abwesenheiten – Plus und offline', () => {
  it('das Plus öffnet „Zeitraum eintragen" mit dem nächsten Termin als Start', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum eintragen' }));
    expect(screen.getByText('Zeitraum eintragen')).not.toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Von').value).toBe('2026-10-04');
    fireEvent.click(screen.getByRole('button', { name: '1 Woche' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eintragen (7 Tage)' }));
    expect(anlegen).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-10-04', endDate: '2026-10-10', reasonId: 1 }),
      expect.anything(),
    );
  });

  it('offline sind Kästchen und Plus gesperrt, Ansehen geht', () => {
    zeige(false);
    expect(kasten(/So, 04\.10\./).disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Zeitraum eintragen' }).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Einträge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Früher (1)' }));
    const alt = screen.getByRole<HTMLButtonElement>('button', { name: /ansehen/ });
    expect(alt.disabled).toBe(false);
  });
});
