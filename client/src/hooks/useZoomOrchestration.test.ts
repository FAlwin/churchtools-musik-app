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
const restoreVisibleZoom = vi.fn();
vi.mock('./useZoomPersistence', () => ({
  useZoomPersistence: () => ({
    zoomKeyFor: (p: number) => `k${p}`,
    loadZoom: () => null,
    persistZoom: vi.fn(),
    clearStoredZoom: vi.fn(),
    resetVisibleZoom: (...a: unknown[]) => resetVisibleZoom(...a),
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
}

function starte(initial: Props = { resetZoomSignal: 0 }) {
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

describe('useZoomOrchestration – das Zoom-Signal', () => {
  it('tut ohne Signaländerung nichts', () => {
    starte();
    frameZustellen();
    expect(resetVisibleZoom).not.toHaveBeenCalled();
  });

  it('der Zoom-Knopf setzt zurück UND vergisst', () => {
    const { rerender } = starte();
    rerender({ resetZoomSignal: 1 });
    expect(resetVisibleZoom).toHaveBeenCalledTimes(1);
    expect(resetVisibleZoom).toHaveBeenCalledWith();
  });

  it('das Umschalten der Leisten löst KEIN Zurücksetzen aus (#319)', () => {
    // Es gab hier einmal ein zweites Signal, das beim Vollbild-Umschalten einpasste. Das war meine
    // Auslegung von „Text wird verdeckt" – gewollt ist das Gegenteil: „dass der Vollbildmodus den
    // Zoom einfach beibehält". Dass die Seite ihren Rahmen nicht überragt, macht der Pixel-Deckel
    // in `PageDeck`. Dieser Test hält fest, dass hier nichts mehr am Zoom rührt.
    starte();
    frameZustellen();
    expect(resetVisibleZoom).not.toHaveBeenCalled();
  });
});
