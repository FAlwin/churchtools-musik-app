// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';

/**
 * #319: Prüft die VERDRAHTUNG der beiden Zoom-Signale – nicht, was sie tun (das prüft
 * `useZoomPersistence.test.ts`), sondern **dass das richtige Signal die richtige Wirkung auslöst.**
 *
 * Diese Lücke fiel bei einer Gegenprobe auf: Nimmt man die Zeile heraus, die das Einpass-Signal
 * verarbeitet, fiel **kein einziger Test**. Im Browser ließ sich das gerade nicht nachholen, weil
 * der Seitenaufbau bei ausgeblendeter Vorschau gedrosselt wird – also gehört es hierher, wo es an
 * keiner Umgebung hängt.
 */
const resetVisibleZoom = vi.fn();
const fitVisibleZoom = vi.fn();
const restoreVisibleZoom = vi.fn();
vi.mock('./useZoomPersistence', () => ({
  useZoomPersistence: () => ({
    zoomKeyFor: (p: number) => `k${p}`,
    loadZoom: () => null,
    persistZoom: vi.fn(),
    clearStoredZoom: vi.fn(),
    resetVisibleZoom: (...a: unknown[]) => resetVisibleZoom(...a),
    fitVisibleZoom: () => fitVisibleZoom(),
    restoreVisibleZoom: (...a: unknown[]) => restoreVisibleZoom(...a),
  }),
}));

const { useZoomOrchestration } = await import('./useZoomOrchestration');

const ref = () =>
  ({
    current: { resetTransform: vi.fn() },
  }) as unknown as MutableRefObject<ReactZoomPanPinchRef | null>;

interface Props {
  resetZoomSignal: number;
  fitZoomSignal: number;
}

function starte(initial: Props = { resetZoomSignal: 0, fitZoomSignal: 0 }) {
  return renderHook(
    (p: Props) =>
      useZoomOrchestration({
        zoomKeyBaseFor: (page: number) => `worship_doczoom_song1_voriginal_${page}`,
        pageIndex: 0,
        perView: 1,
        pages: [],
        loading: false,
        syncTick: 0,
        transformRefs: [ref(), ref()],
        resetZoomSignal: p.resetZoomSignal,
        fitZoomSignal: p.fitZoomSignal,
      }),
    { initialProps: initial },
  );
}

/** Das Einpass-Signal wirkt über ein rAF – hier zustellen. */
function frameZustellen() {
  act(() => {
    const q = warteschlange;
    warteschlange = [];
    for (const cb of q) cb(0);
  });
}
let warteschlange: FrameRequestCallback[] = [];

beforeEach(() => {
  warteschlange = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    warteschlange.push(cb);
    return warteschlange.length;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useZoomOrchestration – die beiden Zoom-Signale', () => {
  it('tut ohne Signaländerung nichts', () => {
    const { rerender } = starte();
    rerender({ resetZoomSignal: 0, fitZoomSignal: 0 });
    frameZustellen();
    expect(resetVisibleZoom).not.toHaveBeenCalled();
    expect(fitVisibleZoom).not.toHaveBeenCalled();
  });

  it('der Zoom-Knopf setzt zurück UND vergisst (ohne keepStored)', () => {
    const { rerender } = starte();
    resetVisibleZoom.mockClear();
    rerender({ resetZoomSignal: 1, fitZoomSignal: 0 });
    expect(resetVisibleZoom).toHaveBeenCalledTimes(1);
    expect(resetVisibleZoom).toHaveBeenCalledWith();
  });

  it('das Einpass-Signal ruft das EINPASSEN – nicht das Zurücksetzen', () => {
    const { rerender } = starte();
    rerender({ resetZoomSignal: 0, fitZoomSignal: 1 });
    frameZustellen();
    expect(fitVisibleZoom).toHaveBeenCalledTimes(1);
    expect(resetVisibleZoom).not.toHaveBeenCalled(); // sonst wäre der Zoom vergessen
  });

  it('passt erst NACH einem Frame ein – die neue Höhe muss im Layout stehen', () => {
    const { rerender } = starte();
    rerender({ resetZoomSignal: 0, fitZoomSignal: 1 });
    expect(fitVisibleZoom).not.toHaveBeenCalled(); // noch nicht
    frameZustellen();
    expect(fitVisibleZoom).toHaveBeenCalledTimes(1);
  });

  it('reagiert auf jedes weitere Umschalten erneut', () => {
    const { rerender } = starte();
    for (const n of [1, 2, 3]) {
      rerender({ resetZoomSignal: 0, fitZoomSignal: n });
      frameZustellen();
    }
    expect(fitVisibleZoom).toHaveBeenCalledTimes(3);
  });
});
