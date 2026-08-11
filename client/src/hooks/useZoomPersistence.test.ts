// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';

/**
 * Zoom-Ablage: Was wird gemerkt, was vergessen?
 *
 * Der Zoom-Knopf in der Kopfzeile setzt zurück UND vergisst – dort IST das die Absicht. Alles
 * andere (Blättern, Abgleich, Wiederkehr in die App) stellt den gespeicherten Wert wieder her.
 *
 * **Was hier NICHT mehr steht:** Bis v2.18 passte das Aus-/Einblenden der Leisten die Seite auch
 * gleich neu ein. Das war ein Missverständnis des ersten Berichts zu #319 – gewollt ist, dass das
 * Vollbild die Vergrößerung behält. Die Mechanik ist ersatzlos entfallen; dass die Seite ihren
 * Rahmen nicht überragt, macht der Pixel-Deckel in `PageDeck`.
 */
vi.mock('../services/annotations', () => ({ pushField: vi.fn() }));
vi.mock('../utils/deviceClass', () => ({ deviceClass: () => 'large' }));

const { useZoomPersistence } = await import('./useZoomPersistence');

/** Eine Zoom-Ebene, die mitschreibt, ob sie zurückgesetzt wurde. */
function ebene() {
  const resetTransform = vi.fn();
  const setTransform = vi.fn();
  const ref = {
    current: {
      resetTransform,
      setTransform,
      instance: { transformState: { scale: 1.8, positionX: 0, positionY: 0 } },
    } as unknown as ReactZoomPanPinchRef,
  };
  return {
    ref: ref as MutableRefObject<ReactZoomPanPinchRef | null>,
    resetTransform,
    setTransform,
  };
}

function starte(zoomedSlots: [boolean, boolean] = [true, false]) {
  const a = ebene();
  const b = ebene();
  const args = {
    zoomKeyBaseFor: (p: number) => `worship_doczoom_song1_voriginal_${p}`,
    perView: 1,
    pageIndex: 0,
    transformRefs: [a.ref, b.ref],
    lastScale: { current: [1, 1] } as MutableRefObject<[number, number]>,
    gestureSlot: { current: null } as MutableRefObject<number | null>,
    zoomedSlots,
  };
  return { ...renderHook(() => useZoomPersistence(args)), a, b, args };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.clearAllMocks());

describe('resetVisibleZoom – einpassen', () => {
  it('setzt die sichtbare Seite auf Einpassen zurück', () => {
    const { result, a } = starte();
    result.current.resetVisibleZoom();
    expect(a.resetTransform).toHaveBeenCalled();
  });

  it('lässt Seiten in Ruhe, die gar nicht vergrößert sind', () => {
    const { result, a } = starte([false, false]);
    result.current.resetVisibleZoom();
    expect(a.resetTransform).not.toHaveBeenCalled();
  });
});

/**
 * Einen gespeicherten Zoom über den ECHTEN Weg anlegen: `persistZoom` sichert nur während einer
 * laufenden Geste (`gestureSlot`) – genau so entsteht ein gespeicherter Zoom im Betrieb.
 *
 * Steht auf Modulebene, weil zwei Blöcke sie brauchen (seit #319 auch der zum Einpassen).
 */
function zoomSpeichern(
  result: { current: ReturnType<typeof useZoomPersistence> },
  args: { gestureSlot: { current: number | null } },
) {
  args.gestureSlot.current = 0; // Nutzer pincht gerade auf Slot 0
  result.current.persistZoom(0);
  args.gestureSlot.current = null; // Geste vorbei
  expect(result.current.loadZoom(0)).not.toBeNull();
}

describe('resetVisibleZoom – merken oder vergessen', () => {
  it('vergisst den gespeicherten Zoom – das ist die Absicht des Zoom-Knopfs', () => {
    const { result, args } = starte();
    zoomSpeichern(result, args);
    result.current.resetVisibleZoom();
    expect(result.current.loadZoom(0)).toBeNull();
  });
});
