// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

/**
 * #314: Der Hook ist absichtlich dünn – das Laden macht `loadAppLogo`. Geprüft wird deshalb genau
 * das, was die Hülle beiträgt:
 *
 *  - Sie **lädt nicht selbst**. Genau das war der Fehler: Das Vorladen stand zweimal von Hand
 *    daneben, obwohl es die Funktion längst gab, und nur die Funktion behandelt `onerror`.
 *  - Ein **fehlendes Logo hält nichts auf** – die PDF entsteht dann eben ohne.
 *  - Nach dem Verlassen wird **kein Zustand mehr gesetzt**.
 */
const loadAppLogo = vi.fn();
vi.mock('../utils/logoAsset', () => ({
  logoTightUrl: 'data:image/png;base64,AA',
  loadAppLogo: () => loadAppLogo(),
}));

const { useAppLogo } = await import('./useAppLogo');

afterEach(() => {
  vi.clearAllMocks();
});

describe('useAppLogo', () => {
  it('geht über loadAppLogo, statt das Vorladen ein drittes Mal hinzuschreiben', async () => {
    loadAppLogo.mockResolvedValue(null);
    renderHook(() => useAppLogo());
    await act(async () => {});
    expect(loadAppLogo).toHaveBeenCalledTimes(1);
  });

  it('liefert erst null und dann das geladene Bild', async () => {
    const bild = {} as HTMLImageElement;
    loadAppLogo.mockResolvedValue(bild);
    const { result } = renderHook(() => useAppLogo());
    expect(result.current).toBeNull();
    await act(async () => {});
    expect(result.current).toBe(bild);
  });

  it('bleibt bei null, wenn das Bild nicht geladen werden konnte – ohne hängen zu bleiben', async () => {
    loadAppLogo.mockResolvedValue(null);
    const { result } = renderHook(() => useAppLogo());
    await act(async () => {});
    expect(result.current).toBeNull();
  });

  it('setzt nach dem Verlassen keinen Zustand mehr', async () => {
    let aufloesen: (v: HTMLImageElement | null) => void = () => {};
    loadAppLogo.mockReturnValue(
      new Promise<HTMLImageElement | null>((r) => {
        aufloesen = r;
      }),
    );
    const warnungen = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderHook(() => useAppLogo());
    unmount();
    await act(async () => {
      aufloesen({} as HTMLImageElement);
    });
    expect(warnungen).not.toHaveBeenCalled();
    warnungen.mockRestore();
  });
});
