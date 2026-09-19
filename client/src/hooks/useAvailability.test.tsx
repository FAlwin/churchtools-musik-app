// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * #177: Nach Anlegen oder Löschen muss die eigene Liste neu geholt werden – sonst zeigt der Termin
 * weiter „Kann nicht", obwohl die Abmeldung längst in ChurchTools steht. Die Termine selbst ändern
 * sich durch eine Abwesenheit nicht und werden NICHT verworfen (sie kosten einen ChurchTools-Aufruf).
 */
vi.mock('../services/availability', () => ({
  getMyAbsences: vi.fn(),
  getAbsenceEvents: vi.fn(),
  createAbsence: vi.fn(),
  deleteAbsence: vi.fn(),
}));

const api = await import('../services/availability');
const { useCreateAbsence, useDeleteAbsence, useSaveAbsenceChanges, ABSENCES_KEY } =
  await import('./useAvailability');

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

describe('useAvailability – Schreibvorgänge verwerfen die eigene Liste', () => {
  it('Anlegen holt die Liste neu, die Termine nicht', async () => {
    vi.mocked(api.createAbsence).mockResolvedValue({
      id: 5,
      startDate: '2026-10-04',
      endDate: '2026-10-04',
      comment: '',
      reason: null,
      reasonId: null,
      vonApp: true,
    });
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateAbsence(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ startDate: '2026-10-04', endDate: '2026-10-04' });
    });
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: [...ABSENCES_KEY, 'mine'] }));
    expect(spy).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: [...ABSENCES_KEY, 'events'] }),
    );
  });

  it('Löschen holt die Liste neu', async () => {
    vi.mocked(api.deleteAbsence).mockResolvedValue(undefined);
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteAbsence(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(5);
    });
    expect(api.deleteAbsence).toHaveBeenCalledWith(5);
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: [...ABSENCES_KEY, 'mine'] }));
  });
});

/**
 * Gesammeltes Speichern (19.09.2026): erst anlegen, dann löschen, alles nacheinander – und die Liste
 * wird auch nach einem Fehlschlag neu geholt, damit sie den wahren Stand zeigt.
 */
describe('useSaveAbsenceChanges – alle Häkchen auf einmal', () => {
  it('legt erst an, löscht dann, nacheinander, und holt die Liste neu', async () => {
    const folge: string[] = [];
    vi.mocked(api.createAbsence).mockImplementation(async (n) => {
      folge.push(`neu ${n.startDate}`);
      return {
        id: 1,
        startDate: n.startDate,
        endDate: n.endDate,
        comment: '',
        reason: null,
        reasonId: null,
        vonApp: true,
      };
    });
    vi.mocked(api.deleteAbsence).mockImplementation(async (id) => {
      folge.push(`weg ${id}`);
    });
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSaveAbsenceChanges(), { wrapper });
    let anzahl = 0;
    await act(async () => {
      anzahl = await result.current.mutateAsync({
        eintragen: ['2026-10-04', '2026-10-11'],
        loeschen: [7],
      });
    });
    expect(folge).toEqual(['neu 2026-10-04', 'neu 2026-10-11', 'weg 7']);
    expect(anzahl).toBe(3);
    expect(api.createAbsence).toHaveBeenCalledWith({
      startDate: '2026-10-04',
      endDate: '2026-10-04',
    });
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: [...ABSENCES_KEY, 'mine'] }));
  });

  it('nach einem Fehlschlag in der Mitte wird trotzdem neu geholt – die Liste zeigt den wahren Stand', async () => {
    vi.mocked(api.createAbsence).mockRejectedValue(new Error('429'));
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSaveAbsenceChanges(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ eintragen: ['2026-10-04'], loeschen: [7] }),
      ).rejects.toThrow();
    });
    expect(api.deleteAbsence).not.toHaveBeenCalled();
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: [...ABSENCES_KEY, 'mine'] }));
  });
});
