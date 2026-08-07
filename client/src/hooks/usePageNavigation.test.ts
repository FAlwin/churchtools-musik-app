// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { usePageNavigation } from './usePageNavigation';

/**
 * #319: Der Hook war ungetestet, obwohl er die Bedienung des Liedblatts trägt – und mit dem Vollbild
 * kam eine dritte Bedeutung des Tipps dazu.
 *
 * Geprüft wird vor allem, was sich gegenseitig ausschließen muss:
 *  - **Der Rand blättert, die Mitte nicht.** Ein Tipp am Rand darf die Leisten nicht umschalten.
 *  - **Im Zeichenmodus passiert gar nichts** – dort gehört der Finger dem Stift.
 *  - **Nach einem Touch wird der nachgereichte Klick verworfen.** iOS schickt beides; ohne die
 *    Sperre würde jede Bedienung doppelt ausgeführt.
 */
const BREITE = 1000;

/** Ein Element, dessen Maße feststehen – der Hook rechnet die Zone aus der Breite. */
function flaeche(): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({ left: 0, width: BREITE, top: 0, height: 500, right: BREITE, bottom: 500 }) as DOMRect;
  return el;
}

function starte(over: Partial<Parameters<typeof usePageNavigation>[0]> = {}) {
  const args = {
    pageIndex: 2,
    pageCount: 10,
    perView: 1,
    drawMode: false,
    onPageIndex: vi.fn(),
    onActivePage: vi.fn(),
    onMiddleTap: vi.fn(),
    ...over,
  };
  return { ...renderHook(() => usePageNavigation(args)), args };
}

/** Einen Mausklick an der Stelle `anteil` (0..1) der Breite auslösen. */
function klick(
  result: { current: ReturnType<typeof usePageNavigation> },
  anteil: number,
  ziel = flaeche(),
) {
  act(() =>
    result.current.onClick({
      clientX: anteil * BREITE,
      currentTarget: ziel,
    } as unknown as React.MouseEvent),
  );
}

afterEach(() => vi.clearAllMocks());

describe('usePageNavigation – die drei Zonen', () => {
  it('blättert am linken Rand zurück', () => {
    const { result, args } = starte();
    klick(result, 0.1);
    expect(args.onPageIndex).toHaveBeenCalledWith(1);
    expect(args.onMiddleTap).not.toHaveBeenCalled();
  });

  it('blättert am rechten Rand weiter', () => {
    const { result, args } = starte();
    klick(result, 0.9);
    expect(args.onPageIndex).toHaveBeenCalledWith(3);
    expect(args.onMiddleTap).not.toHaveBeenCalled();
  });

  it('schaltet in der Mitte die Leisten um, ohne zu blättern (#319)', () => {
    const { result, args } = starte();
    klick(result, 0.5);
    expect(args.onMiddleTap).toHaveBeenCalledTimes(1);
    expect(args.onPageIndex).not.toHaveBeenCalled();
  });

  it('tut das auch im Hochformat – dort war die Mitte vorher wirkungslos', () => {
    const { result, args } = starte({ perView: 1 });
    klick(result, 0.4);
    expect(args.onMiddleTap).toHaveBeenCalledTimes(1);
    expect(args.onActivePage).not.toHaveBeenCalled();
  });

  it('macht im Querformat BEIDES: Leisten umschalten und Hälfte wählen', () => {
    const { result, args } = starte({ perView: 2 });
    klick(result, 0.7); // rechte Hälfte, aber innerhalb der Mitte-Zone
    expect(args.onMiddleTap).toHaveBeenCalledTimes(1);
    expect(args.onActivePage).toHaveBeenCalledWith(3);
  });

  it('wählt im Querformat links die linke Hälfte', () => {
    const { result, args } = starte({ perView: 2 });
    klick(result, 0.3);
    expect(args.onActivePage).toHaveBeenCalledWith(2);
  });
});

describe('usePageNavigation – Grenzen', () => {
  it('läuft am Anfang nicht nach hinten hinaus', () => {
    const { result, args } = starte({ pageIndex: 0 });
    klick(result, 0.1);
    expect(args.onPageIndex).not.toHaveBeenCalled();
  });

  it('läuft am Ende nicht nach vorn hinaus', () => {
    const { result, args } = starte({ pageIndex: 9, pageCount: 10 });
    klick(result, 0.9);
    expect(args.onPageIndex).not.toHaveBeenCalled();
  });

  it('lässt im Querformat nie eine Seite allein stehen', () => {
    const { result, args } = starte({ perView: 2, pageIndex: 8, pageCount: 10 });
    klick(result, 0.9);
    expect(args.onPageIndex).not.toHaveBeenCalled(); // 8 ist schon die letzte linke Seite
  });
});

describe('usePageNavigation – im Zeichenmodus passiert nichts', () => {
  it('ignoriert Klicks', () => {
    const { result, args } = starte({ drawMode: true });
    klick(result, 0.1);
    klick(result, 0.5);
    expect(args.onPageIndex).not.toHaveBeenCalled();
    expect(args.onMiddleTap).not.toHaveBeenCalled();
  });

  it('ignoriert auch Wischen', () => {
    const { result, args } = starte({ drawMode: true });
    const ziel = flaeche();
    act(() => {
      result.current.onTouchStart({
        touches: [{ clientX: 800, clientY: 100 }],
      } as unknown as React.TouchEvent);
      result.current.onTouchEnd({
        changedTouches: [{ clientX: 200, clientY: 100 }],
        currentTarget: ziel,
      } as unknown as React.TouchEvent);
    });
    expect(args.onPageIndex).not.toHaveBeenCalled();
  });
});

describe('usePageNavigation – Wischen und der nachgereichte Klick', () => {
  /** Wisch von `vonX` nach `nachX` (jeweils absolute Pixel). */
  function wisch(
    result: { current: ReturnType<typeof usePageNavigation> },
    vonX: number,
    nachX: number,
    vonY = 100,
    nachY = 100,
  ) {
    const ziel = flaeche();
    act(() => {
      result.current.onTouchStart({
        touches: [{ clientX: vonX, clientY: vonY }],
      } as unknown as React.TouchEvent);
      result.current.onTouchEnd({
        changedTouches: [{ clientX: nachX, clientY: nachY }],
        currentTarget: ziel,
      } as unknown as React.TouchEvent);
    });
  }

  it('blättert bei einem deutlichen Wisch nach links weiter', () => {
    const { result, args } = starte();
    wisch(result, 800, 200);
    expect(args.onPageIndex).toHaveBeenCalledWith(3);
  });

  it('tut bei einem abgebrochenen Wisch NICHTS – weder blättern noch umschalten', () => {
    // 25 px: zu weit für einen Tipp (<12), zu kurz für einen Wisch (>45).
    const { result, args } = starte();
    wisch(result, 500, 475);
    expect(args.onPageIndex).not.toHaveBeenCalled();
    expect(args.onMiddleTap).not.toHaveBeenCalled();
  });

  it('wertet einen senkrechten Wisch nicht als Blättern', () => {
    const { result, args } = starte();
    wisch(result, 500, 460, 100, 400);
    expect(args.onPageIndex).not.toHaveBeenCalled();
  });

  it('verwirft den Klick, den iOS nach einem Touch nachreicht', () => {
    const { result, args } = starte();
    wisch(result, 500, 500); // Tipp in die Mitte per Touch
    expect(args.onMiddleTap).toHaveBeenCalledTimes(1);
    klick(result, 0.5); // der nachgereichte Klick …
    expect(args.onMiddleTap).toHaveBeenCalledTimes(1); // … darf nicht doppelt schalten
  });
});
