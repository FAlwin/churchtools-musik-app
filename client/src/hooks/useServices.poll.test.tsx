// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * #306: Der 60-Sekunden-Takt der Terminliste lief auch, wenn man die Liste gar nicht sieht.
 *
 * Jede Runde kostet rund `1 + 2 × Termine` ChurchTools-Anfragen (~17 im Standardfenster) – bei fünf
 * Geräten im Gottesdienst die **größte Dauerlast der App**, deutlich mehr als der Statistik-Burst aus
 * #300. Der frühere Kommentar behauptete „solange die Liste sichtbar ist"; pausiert wurde aber nur,
 * wenn der ganze Browser-Tab in den Hintergrund ging – im Liederheft lief er weiter.
 *
 * Geprüft wird das **Verhalten** (feuert der Takt?), nicht die Option: Ein Test, der nur nachsieht, ob
 * `refetchInterval` gesetzt ist, würde dieselbe Zeile zweimal hinschreiben und nichts beweisen.
 */
vi.mock('../services/churchtoolsApi', () => ({ getServices: vi.fn() }));

const api = await import('../services/churchtoolsApi');
const { useServices } = await import('./useServices');

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  // Fake-Timer VON ANFANG AN: React Query legt den Takt-Timer beim ersten Rendern an. Schaltet man
  // erst danach um, läuft er unter echten Timern weiter und Vorspulen wirkt nicht – der Test wäre
  // dann grün, ohne etwas zu beweisen (genau das ist der ersten Fassung passiert).
  vi.useFakeTimers();
  vi.mocked(api.getServices).mockResolvedValue([]);
  vi.mocked(api.getServices).mockClear();
});
afterEach(() => vi.useRealTimers());

describe('useServices – Takt nur bei sichtbarer Liste (#306)', () => {
  it('sichtbare Liste: nach 60 Sekunden wird erneut geladen', async () => {
    renderHook(() => useServices(true, true), { wrapper });
    await vi.advanceTimersByTimeAsync(0); // erstes Laden abschließen
    expect(api.getServices).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(61_000);
    expect(api.getServices).toHaveBeenCalledTimes(2);
  });

  it('verborgene Liste: nach 60 Sekunden passiert nichts mehr', async () => {
    renderHook(() => useServices(true, false), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(api.getServices).toHaveBeenCalledTimes(1); // einmal laden ja …

    await vi.advanceTimersByTimeAsync(61_000);
    expect(api.getServices).toHaveBeenCalledTimes(1); // … aber kein Takt
  });

  it('ohne Takt bleibt die Abfrage AKTIV – die Daten werden weiter gebraucht', async () => {
    // Wichtige Abgrenzung: `enabled` auf false zu setzen wäre falsch. `useAppNav` findet damit nach
    // einem Kaltstart den gespeicherten Gottesdienst wieder, und die Offline-Vorbereitung hängt
    // ebenfalls daran.
    const { result } = renderHook(() => useServices(true, false), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.data).toEqual([]);
  });
});
