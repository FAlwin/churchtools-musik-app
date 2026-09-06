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
const { useCreateAbsence, useDeleteAbsence, ABSENCES_KEY } = await import('./useAvailability');

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
      eigene: true,
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
