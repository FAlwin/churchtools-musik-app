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

/**
 * Der Client wird je Test EINMAL angelegt, nicht im Wrapper: Stünde `new QueryClient()` im
 * Wrapper-Rumpf, bekäme jedes `rerender` einen frischen Client – die Abfrage würde neu montiert und
 * lüde von selbst nach. Der Rückkehr-Test unten wäre dann grün, ohne irgendetwas zu beweisen.
 */
let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
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

  it('Rückkehr zur Liste lädt SOFORT nach – nicht erst nach 60 Sekunden', async () => {
    // Die zweite Hälfte von #306. React Query startet beim Wiedereinschalten nur den Timer neu und
    // holt NICHT von sich aus – ohne das Nachladen im Hook zeigte die Liste nach zehn Minuten im
    // Liederheft zehn Minuten alte Daten, und das noch bis zu 60 s lang. Vorher lief der Takt durch.
    const { rerender } = renderHook(({ p }) => useServices(true, p), {
      wrapper,
      initialProps: { p: false },
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(api.getServices).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5 * 60_000); // fünf Minuten „im Liederheft"
    expect(api.getServices).toHaveBeenCalledTimes(1);

    rerender({ p: true }); // zurück auf die Terminliste
    await vi.advanceTimersByTimeAsync(0);
    expect(api.getServices).toHaveBeenCalledTimes(2); // sofort – nicht in 60 Sekunden
  });

  it('bleibt die Liste sichtbar, löst das kein zusätzliches Laden aus', async () => {
    // Gegenrichtung: Nur der WECHSEL verborgen→sichtbar darf nachladen. Löste jedes Render aus,
    // wäre die Ersparnis dahin.
    const { rerender } = renderHook(({ p }) => useServices(true, p), {
      wrapper,
      initialProps: { p: true },
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(api.getServices).toHaveBeenCalledTimes(1);

    rerender({ p: true });
    rerender({ p: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(api.getServices).toHaveBeenCalledTimes(1);
  });

  it('ohne Takt bleibt die Abfrage AKTIV – die Daten werden weiter gebraucht', async () => {
    // Wichtige Abgrenzung: `enabled` auf false zu setzen wäre falsch. `useAppNav` findet damit nach
    // einem Kaltstart den gespeicherten Gottesdienst wieder, und die Offline-Vorbereitung hängt
    // ebenfalls daran.
    const { result } = renderHook(() => useServices(true, false), { wrapper });
    // Etwas mehr als 0 vorspulen: React verteilt das Rendern nach dem aufgelösten Versprechen über
    // den Scheduler, und der hängt unter Fake-Timern selbst an einem Timer.
    await vi.advanceTimersByTimeAsync(100);
    expect(result.current.data).toEqual([]);
    expect(result.current.isSuccess).toBe(true);
  });
});
