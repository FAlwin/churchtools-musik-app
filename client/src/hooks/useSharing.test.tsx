// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

/**
 * #276: Ein vorübergehender Fehler ist NICHT „teilt nicht".
 *
 * Der gefährliche Fall ist das **Abschalten**: Vorher drehte der Schalter bei einem Fehler stumm
 * zurück (und der Server meldete beim Speichern sogar Erfolg, ohne zu schreiben). Wer sein Teilen
 * abschalten wollte, hielt es für erledigt – seine Anmerkungen blieben aber für das Team sichtbar.
 * Deshalb muss der Nutzer es hier ausdrücklich erfahren.
 */
vi.mock('../services/teamNotes', () => ({
  getSharing: vi.fn(),
  setSharing: vi.fn(),
}));

const api = await import('../services/teamNotes');
const { useSharing } = await import('./useSharing');

beforeEach(() => vi.clearAllMocks());

describe('useSharing – Stand laden', () => {
  it('liefert den Stand vom Server', async () => {
    vi.mocked(api.getSharing).mockResolvedValue({ enabled: true });
    const { result } = renderHook(() => useSharing(true));

    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it('Fehler beim Laden ergibt „unbekannt" mit Meldung – NICHT „aus"', async () => {
    // Das ist der Kern: `enabled` bleibt null. Ein `false` wäre eine falsche Aussage über die
    // Sichtbarkeit der eigenen Notizen.
    vi.mocked(api.getSharing).mockRejectedValue(new Error('weg'));
    const { result } = renderHook(() => useSharing(true));

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.enabled).toBeNull();
  });

  it('fragt gar nicht, wenn der Nutzer keine Team-Notizen darf', () => {
    renderHook(() => useSharing(false));
    expect(api.getSharing).not.toHaveBeenCalled();
  });
});

describe('useSharing – umschalten', () => {
  async function eingeschaltet() {
    vi.mocked(api.getSharing).mockResolvedValue({ enabled: true });
    const view = renderHook(() => useSharing(true));
    await waitFor(() => expect(view.result.current.enabled).toBe(true));
    return view;
  }

  it('erfolgreiches Abschalten: Schalter aus, keine Meldung', async () => {
    const { result } = await eingeschaltet();
    vi.mocked(api.setSharing).mockResolvedValue({ enabled: false });

    act(() => result.current.toggle());

    await waitFor(() => expect(result.current.enabled).toBe(false));
    expect(result.current.error).toBeNull();
    expect(api.setSharing).toHaveBeenCalledWith(false);
  });

  it('gescheitertes ABSCHALTEN: Schalter zurück auf ein UND deutliche Meldung', async () => {
    // Der Fall aus #276. Die Meldung muss sagen, dass weiter geteilt wird – „ging nicht" allein
    // würde jemand als „ist wohl trotzdem aus" lesen.
    const { result } = await eingeschaltet();
    vi.mocked(api.setSharing).mockRejectedValue(new Error('kein Platz'));

    act(() => result.current.toggle());

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.enabled).toBe(true);
    expect(result.current.error).toMatch(/weiter sichtbar/i);
  });

  it('gescheitertes Einschalten: Schalter zurück auf aus, eigene Meldung', async () => {
    vi.mocked(api.getSharing).mockResolvedValue({ enabled: false });
    const { result } = renderHook(() => useSharing(true));
    await waitFor(() => expect(result.current.enabled).toBe(false));
    vi.mocked(api.setSharing).mockRejectedValue(new Error('weg'));

    act(() => result.current.toggle());

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.enabled).toBe(false);
    expect(result.current.error).not.toMatch(/weiter sichtbar/i);
  });

  it('bei unbekanntem Stand schaltet nichts um', async () => {
    vi.mocked(api.getSharing).mockRejectedValue(new Error('weg'));
    const { result } = renderHook(() => useSharing(true));
    await waitFor(() => expect(result.current.error).toBeTruthy());

    act(() => result.current.toggle());

    expect(api.setSharing).not.toHaveBeenCalled();
    expect(result.current.enabled).toBeNull();
  });

  it('ein erneuter Versuch räumt die alte Meldung weg', async () => {
    const { result } = await eingeschaltet();
    vi.mocked(api.setSharing).mockRejectedValueOnce(new Error('weg'));
    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.error).toBeTruthy());

    vi.mocked(api.setSharing).mockResolvedValue({ enabled: false });
    act(() => result.current.toggle());

    await waitFor(() => expect(result.current.enabled).toBe(false));
    expect(result.current.error).toBeNull();
  });
});
