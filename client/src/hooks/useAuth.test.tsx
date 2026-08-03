// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '../services/api';

/**
 * #270: „ChurchTools antwortet nicht" ist NICHT „abgemeldet".
 *
 * Vorher endete jeder Fehler bei der Statusabfrage im Login-Screen – und wer den sieht, tippt seine
 * ChurchTools-Zugangsdaten ein, auch wenn die Anmeldung noch gilt. `statusUnknown` trennt beides, damit
 * die App bei einem Aussetzer eine Meldung mit „Erneut versuchen" zeigen kann.
 *
 * Ein **401** gehört ausdrücklich NICHT dazu: Dann ist die Sitzung wirklich tot und der Login ist
 * richtig (#186 – kein Screen darf ein 401 als „Erneut versuchen" anbieten).
 */
vi.mock('../services/churchtoolsApi', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

const api = await import('../services/churchtoolsApi');
const { useAuth } = await import('./useAuth');

function wrapper({ children }: { children: ReactNode }) {
  // retry aus: sonst wartet der Test auf die Wiederholungen der Query.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe('useAuth.statusUnknown (#270)', () => {
  it('Zeitüberschreitung (504) → Status unklar, NICHT abgemeldet', async () => {
    vi.mocked(api.getMe).mockRejectedValue(new ApiError(504, 'ChurchTools antwortet nicht.'));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.statusUnknown).toBe(true));
    expect(result.current.isAuthenticated).toBe(false); // kein „angemeldet" vorgetäuscht
  });

  it('502 → Status unklar', async () => {
    vi.mocked(api.getMe).mockRejectedValue(new ApiError(502, 'ChurchTools-Fehler.'));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.statusUnknown).toBe(true));
  });

  it('401 → NICHT unklar, sondern abgemeldet (der Login gehört hin)', async () => {
    vi.mocked(api.getMe).mockRejectedValue(new ApiError(401, 'Nicht angemeldet.'));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.statusUnknown).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('angemeldet → weder unklar noch abgemeldet', async () => {
    vi.mocked(api.getMe).mockResolvedValue({
      authenticated: true,
      user: { id: 42, firstName: 'Test', lastName: 'Musiker' },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.statusUnknown).toBe(false);
  });

  it('reguläre Antwort „nicht angemeldet" ist auch nicht unklar', async () => {
    // Der Weg ohne Cookie: 200 mit authenticated:false – da MUSS der Login kommen.
    vi.mocked(api.getMe).mockResolvedValue({ authenticated: false });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.statusUnknown).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('retryStatus fragt den Status erneut ab', async () => {
    vi.mocked(api.getMe).mockRejectedValue(new ApiError(504, 'weg'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.statusUnknown).toBe(true));

    // Danach antwortet ChurchTools wieder – ohne erneutes Abfragen bliebe die Meldung stehen.
    vi.mocked(api.getMe).mockResolvedValue({
      authenticated: true,
      user: { id: 42, firstName: 'Test', lastName: 'Musiker' },
    });
    result.current.retryStatus();

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.statusUnknown).toBe(false);
  });
});
