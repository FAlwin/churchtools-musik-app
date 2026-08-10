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
    eingepasst: { current: new Set<string>() } as MutableRefObject<Set<string>>,
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

  it('BEHÄLT ihn beim Einpassen – Leisten umschalten ist kein Zurücknehmen (#319)', () => {
    const { result, a, args } = starte();
    zoomSpeichern(result, args);
    result.current.fitVisibleZoom();
    // Eingepasst wurde trotzdem …
    expect(a.setTransform).toHaveBeenCalledWith(0, 0, 1, 0);
    // … aber der bewusst gesetzte Zoom ist noch da.
    expect(result.current.loadZoom(0)?.scale).toBe(1.8);
  });
});

describe('fitVisibleZoom – ohne Vorbehalt', () => {
  it('passt AUCH ein, wenn der Merker die Seite nicht als vergrößert führt', () => {
    // Genau das war der gemeldete Fehler: `zoomedSlots` wird in `onTransformed` gepflegt und kann
    // im Moment des Umschaltens veraltet sein – dann passierte gar nichts.
    const { result, a } = starte([false, false]);
    result.current.fitVisibleZoom();
    expect(a.setTransform).toHaveBeenCalledWith(0, 0, 1, 0);
  });

  it('passt OHNE Animation ein – eine animierte Rückfahrt wird vom Größenwechsel verworfen', () => {
    // Gemessen im Browser: `resetTransform(150)` ließ den Zoom auf 1,96 stehen, vorher wie nachher.
    // Die Bibliothek fährt den Wert über eine Animation zurück, und genau in dem Moment ändert sich
    // die Größe der Fläche und verwirft sie. Deshalb Dauer 0 – und **kein** `resetTransform` mehr.
    const { result, a } = starte();
    result.current.fitVisibleZoom();
    expect(a.setTransform).toHaveBeenCalledWith(0, 0, 1, 0);
    expect(a.resetTransform).not.toHaveBeenCalled();
  });

  it('passt auch direkt nach einer Geste ein und gibt die Sperre frei (#319)', () => {
    // Anders als die Wiederherstell-Effekte: Die Sperre aus #33 soll einen LAUFENDEN Pinch schützen,
    // hier kann keiner laufen (ein Tipp mit einem Finger, ein Pinch mit zweien). Gemessen steht sie
    // nach dem Zoomen noch rund eine halbe Sekunde – wer sofort danach in die Mitte tippte, bekam
    // gar kein Einpassen. Genau der gemeldete Fall.
    const { result, a, args } = starte();
    args.gestureSlot.current = 0;
    result.current.fitVisibleZoom();
    expect(a.setTransform).toHaveBeenCalledWith(0, 0, 1, 0);
    expect(args.gestureSlot.current).toBeNull();
  });
});

describe('Einpassen haelt – bis der Nutzer selbst wieder zoomt (#319)', () => {
  it('ein spaeterer Abgleich holt den gespeicherten Zoom NICHT zurueck', () => {
    // Der gemeldete Fehler, im Protokoll belegt: Tipp bei 3755 ms, eingepasst bei 3760 ms – und bei
    // 30078 ms holte der 30-Sekunden-Abgleich die alten 1,722 zurueck. Das Einpassen hielt also nur
    // bis zum naechsten Abgleich.
    const { result, a, args } = starte();
    zoomSpeichern(result, args);
    result.current.fitVisibleZoom();
    a.setTransform.mockClear();

    result.current.restoreVisibleZoom({ fitUnsaved: true });
    expect(a.setTransform).not.toHaveBeenCalled();
  });

  it('der gespeicherte Zoom bleibt aber erhalten – er gilt beim Zurueckblaettern wieder', () => {
    const { result, args } = starte();
    zoomSpeichern(result, args);
    result.current.fitVisibleZoom();
    expect(result.current.loadZoom(0)?.scale).toBe(1.8);
  });

  it('zoomt der Nutzer selbst wieder, gewinnt SEIN Wert', () => {
    const { result, a, args } = starte();
    zoomSpeichern(result, args);
    result.current.fitVisibleZoom();
    // Neue Geste: Der Merker faellt weg, ab jetzt gilt wieder das Gespeicherte.
    zoomSpeichern(result, args);
    a.setTransform.mockClear();
    result.current.restoreVisibleZoom({ fitUnsaved: true });
    expect(a.setTransform).toHaveBeenCalled();
  });

  it('gilt nur fuer DIESE Seite – auf einer anderen wird normal wiederhergestellt', () => {
    // Der Merker haengt am Zoom-Schluessel. Blaettert man weiter, gilt dort ein anderer.
    const { result, a, args } = starte();
    zoomSpeichern(result, args);
    result.current.fitVisibleZoom();
    args.pageIndex = 1;
    a.setTransform.mockClear();
    // Auf Seite 1 gibt es nichts Gespeichertes – aber auch keinen Merker, der das Laden verhindert.
    result.current.restoreVisibleZoom({ fitUnsaved: true });
    expect(result.current.loadZoom(0)?.scale).toBe(1.8);
  });
});
