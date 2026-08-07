// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';

/**
 * #319: Beim Aus-/Einblenden der Leisten ändert sich die HÖHE der Anzeigefläche. Eine vergrößerte
 * Seite muss dann neu eingepasst werden – **aber der bewusst gespeicherte Zoom darf nicht
 * verschwinden.** Der Nutzer hat ihn nicht zurückgenommen, er hat nur die Leisten umgeschaltet.
 *
 * Genau das unterscheidet die beiden Fälle, und genau das prüft dieser Test:
 *
 *  - Zoom-Knopf in der Kopfzeile  → einpassen UND vergessen (dort IST das die Absicht)
 *  - Leisten umgeschaltet         → einpassen, aber MERKEN
 *
 * Vorher gab es diese Unterscheidung nicht: `restoreVisibleZoom` wandte den gespeicherten Zoom
 * erneut an – also wieder eine Größe, die in die neue Fläche nicht passte. Das war der gemeldete
 * Fehler „Text wird verdeckt".
 */
vi.mock('../services/annotations', () => ({ pushField: vi.fn() }));
vi.mock('../utils/deviceClass', () => ({ deviceClass: () => 'large' }));

const { useZoomPersistence } = await import('./useZoomPersistence');

/** Eine Zoom-Ebene, die mitschreibt, ob sie zurückgesetzt wurde. */
function ebene() {
  const resetTransform = vi.fn();
  const ref = {
    current: {
      resetTransform,
      setTransform: vi.fn(),
      instance: { transformState: { scale: 1.8, positionX: 0, positionY: 0 } },
    } as unknown as ReactZoomPanPinchRef,
  };
  return { ref: ref as MutableRefObject<ReactZoomPanPinchRef | null>, resetTransform };
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

describe('resetVisibleZoom – merken oder vergessen', () => {
  /**
   * Einen gespeicherten Zoom über den ECHTEN Weg anlegen: `persistZoom` sichert nur während einer
   * laufenden Geste (`gestureSlot`) – genau so entsteht ein gespeicherter Zoom im Betrieb.
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

  it('vergisst den gespeicherten Zoom – das ist die Absicht des Zoom-Knopfs', () => {
    const { result, args } = starte();
    zoomSpeichern(result, args);
    result.current.resetVisibleZoom();
    expect(result.current.loadZoom(0)).toBeNull();
  });

  it('BEHÄLT ihn mit keepStored – beim Umschalten der Leisten (#319)', () => {
    const { result, a, args } = starte();
    zoomSpeichern(result, args);
    result.current.resetVisibleZoom({ keepStored: true });
    // Eingepasst wurde trotzdem …
    expect(a.resetTransform).toHaveBeenCalled();
    // … aber der bewusst gesetzte Zoom ist noch da.
    expect(result.current.loadZoom(0)?.scale).toBe(1.8);
  });
});
