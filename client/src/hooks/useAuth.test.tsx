// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
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
// Das echte Aufräumen fasst IndexedDB und den Datei-Cache an – hier zählt nur, OB es läuft.
const aufraeumen = vi.fn(async () => {});
vi.mock('../utils/clearDeviceData', () => ({ clearDeviceData: () => aufraeumen() }));

const api = await import('../services/churchtoolsApi');
const { useAuth } = await import('./useAuth');
const { getAbmeldenAusstehend, setAbmeldenAusstehend } = await import('../utils/devicePrefs');

function wrapper({ children }: { children: ReactNode }) {
  // retry aus: sonst wartet der Test auf die Wiederholungen der Query.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

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

/**
 * **#403: Abmelden räumt das Gerät auch ohne Netz.** Vorher lief das Aufräumen nur, wenn der Server
 * antwortete – ohne Netz blieben Abläufe mit Personennamen und Anmerkungen auf dem geteilten
 * Gemeindegerät liegen. Und das Anmelde-Cookie (httpOnly, nur der Server kann es löschen) blieb auch:
 * Die nächste Person wäre als die vorige angemeldet gewesen.
 */
describe('useAuth.logout – ohne Netz (#403)', () => {
  it('räumt das Gerät, meldet ab und merkt sich das Nachholen, wenn der Server nicht antwortet', async () => {
    vi.mocked(api.getMe).mockResolvedValue({ authenticated: true });
    vi.mocked(api.logout).mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout(); // darf NICHT werfen – für den Nutzer ist er abgemeldet
    });

    expect(aufraeumen).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(getAbmeldenAusstehend()).toBe(true);
  });

  it('merkt sich nichts, wenn der Server das Abmelden bestätigt', async () => {
    vi.mocked(api.getMe).mockResolvedValue({ authenticated: true });
    vi.mocked(api.logout).mockResolvedValue({ authenticated: false });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(aufraeumen).toHaveBeenCalledTimes(1);
    expect(getAbmeldenAusstehend()).toBe(false);
  });

  it('holt ein ausstehendes Abmelden beim Start nach, BEVOR es den Status fragt', async () => {
    setAbmeldenAusstehend(true);
    vi.mocked(api.logout).mockResolvedValue({ authenticated: false });
    vi.mocked(api.getMe).mockResolvedValue({ authenticated: true }); // das liegengebliebene Cookie
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(api.getMe).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(getAbmeldenAusstehend()).toBe(false);
  });

  it('bleibt abgemeldet, solange das Nachholen scheitert – nie das Konto der vorigen Person', async () => {
    setAbmeldenAusstehend(true);
    vi.mocked(api.logout).mockRejectedValue(new TypeError('Failed to fetch'));
    vi.mocked(api.getMe).mockResolvedValue({ authenticated: true });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.getMe).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(getAbmeldenAusstehend()).toBe(true);
  });

  it('eine neue Anmeldung erledigt ein ausstehendes Abmelden', async () => {
    setAbmeldenAusstehend(true);
    vi.mocked(api.logout).mockRejectedValue(new TypeError('Failed to fetch'));
    vi.mocked(api.login).mockResolvedValue({ authenticated: true });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('a@b.de', 'x');
    });

    expect(getAbmeldenAusstehend()).toBe(false);
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
  });
});
