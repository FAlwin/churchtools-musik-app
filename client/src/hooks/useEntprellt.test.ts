// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntprellt } from './useEntprellt';

/**
 * **Mit Fake-Timern, und das ist keine Formsache.** Mit echten Timern würde der Test entweder warten
 * (langsam und flatterig) oder die Entprellung selbst die Arbeit tun, die er dem Hook zuschreibt –
 * dieses Projekt hatte genau so schon einen Test, der auch ohne den geprüften Fix grün war.
 *
 * Geprüft wird die eine Regel, auf die es ankommt: Zwischenstände dürfen **nicht** durchkommen. Sonst
 * ginge jeder Tastendruck als Suche an CCLI (#300).
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useEntprellt', () => {
  it('gibt den ersten Wert sofort heraus', () => {
    const { result } = renderHook(() => useEntprellt('a', 400));
    expect(result.current).toBe('a');
  });

  it('hält eine Änderung zurück, bis die Zeit um ist', () => {
    const { result, rerender } = renderHook(({ w }) => useEntprellt(w, 400), {
      initialProps: { w: 'a' },
    });
    rerender({ w: 'ab' });
    expect(result.current).toBe('a');

    act(() => void vi.advanceTimersByTime(399));
    expect(result.current).toBe('a');

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe('ab');
  });

  it('überspringt Zwischenstände beim schnellen Tippen – der Kern', () => {
    // „Treu" Buchstabe für Buchstabe: Am Ende darf GENAU ein Wert herauskommen, nicht vier.
    const { result, rerender } = renderHook(({ w }) => useEntprellt(w, 400), {
      initialProps: { w: 'T' },
    });
    for (const w of ['Tr', 'Tre', 'Treu']) {
      act(() => void vi.advanceTimersByTime(100));
      rerender({ w });
    }
    expect(result.current).toBe('T');

    act(() => void vi.advanceTimersByTime(400));
    expect(result.current).toBe('Treu');
  });

  /**
   * **Dieser Test war zuerst wertlos** – er prüfte `not.toThrow()` beim Abbauen, und React wirft dort
   * nicht. Die Gegenprobe (Aufräumen entfernt) blieb grün, also bewachte er nichts.
   *
   * Was das Aufräumen wirklich bewirkt, ist an den ZWISCHENSTÄNDEN messbar: Ohne `clearTimeout` feuert
   * jeder alte Timer noch und setzt seinen veralteten Wert. Zeitachse hier – Entprellung 400 ms:
   *
   *   t=0    'a'                 t=100  → 'b'  (Timer fällig bei 500)
   *   t=200  → 'c' (fällig 600)
   *
   * Mit Aufräumen ist der 'b'-Timer verworfen: bei t=500 steht noch 'a', erst bei t=600 kommt 'c'.
   * Ohne Aufräumen erschiene bei t=500 das veraltete 'b' – ein Zwischenstand, der eine Suche auslöst.
   */
  it('verwirft veraltete Timer – bei t=500 erscheint NICHT der Zwischenstand', () => {
    const { result, rerender } = renderHook(({ w }) => useEntprellt(w, 400), {
      initialProps: { w: 'a' },
    });
    act(() => void vi.advanceTimersByTime(100));
    rerender({ w: 'b' });
    act(() => void vi.advanceTimersByTime(100));
    rerender({ w: 'c' });

    // Jetzt bis t=500: Der 'b'-Timer wäre hier fällig – er darf nicht mehr existieren.
    act(() => void vi.advanceTimersByTime(300));
    expect(result.current).toBe('a');

    act(() => void vi.advanceTimersByTime(100));
    expect(result.current).toBe('c');
  });
});
