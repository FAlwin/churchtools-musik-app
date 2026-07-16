// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageDraw, DEFAULT_TEXT_STYLE } from './usePageDraw';

/**
 * Tests für den Interaktionskern der Anmerkungen (#141). Bewusst ohne echtes Canvas: der Undo/Redo
 * von TEXTEN läuft auch ohne Zeichenfläche (applySnapshot setzt die Texte und bricht beim Strich-
 * Teil sauber ab, wenn keine Canvas da ist). Strich-Persistenz braucht Canvas → hier nicht getestet.
 */
function refs() {
  return {
    strokesRef: { current: null } as React.MutableRefObject<HTMLCanvasElement | null>,
    layerRef: { current: null } as React.MutableRefObject<HTMLDivElement | null>,
  };
}

describe('usePageDraw', () => {
  beforeEach(() => localStorage.clear());

  it('lädt vorhandene Texte aus localStorage', () => {
    const key = 'worship_docdraw_song1_v1_0';
    localStorage.setItem(
      `${key}_text`,
      JSON.stringify([{ id: 1, fx: 0.5, fy: 0.5, text: 'Hallo', color: '#000', sizeCqh: 2 }]),
    );
    const push = vi.fn();
    const { strokesRef, layerRef } = refs();
    const { result } = renderHook(() => usePageDraw(key, strokesRef, layerRef, 0, push));
    expect(result.current.texts).toHaveLength(1);
    expect(result.current.texts[0].text).toBe('Hallo');
  });

  it('fügt Text hinzu, pusht ihn – und ein Re-Render ohne Änderung pusht NICHT erneut (Dedup)', () => {
    const key = 'worship_docdraw_song2_v1_0';
    const push = vi.fn();
    const { strokesRef, layerRef } = refs();
    const { result, rerender } = renderHook(() => usePageDraw(key, strokesRef, layerRef, 0, push));
    act(() => result.current.placeText(0.4, 0.4, 10, 10));
    act(() => result.current.confirmText('Neu', '#000', 2, DEFAULT_TEXT_STYLE));
    expect(result.current.texts).toHaveLength(1);
    expect(result.current.canUndo).toBe(true);
    expect(localStorage.getItem(`${key}_text`)).toContain('Neu');
    const textPushesAfterAdd = push.mock.calls.filter(
      (c) => c[0] === key && c[1] === 'texts',
    ).length;
    expect(textPushesAfterAdd).toBeGreaterThanOrEqual(1);
    // Unveränderter Re-Render: der Speicher-Effekt darf denselben Stand nicht noch einmal pushen.
    act(() => rerender());
    const textPushesAfterRerender = push.mock.calls.filter(
      (c) => c[0] === key && c[1] === 'texts',
    ).length;
    expect(textPushesAfterRerender).toBe(textPushesAfterAdd);
  });

  it('Undo/Redo eines Textes stellt den Stand wieder her', () => {
    const key = 'worship_docdraw_song3_v1_0';
    const push = vi.fn();
    const { strokesRef, layerRef } = refs();
    const { result } = renderHook(() => usePageDraw(key, strokesRef, layerRef, 0, push));
    act(() => result.current.placeText(0.4, 0.4, 10, 10));
    act(() => result.current.confirmText('A', '#000', 2, DEFAULT_TEXT_STYLE));
    expect(result.current.texts).toHaveLength(1);
    act(() => result.current.undo());
    expect(result.current.texts).toHaveLength(0);
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.texts).toHaveLength(1);
    expect(result.current.texts[0].text).toBe('A');
  });

  it('lädt beim Schlüsselwechsel den Text der jeweiligen Seite (Key-Wechsel)', () => {
    const push = vi.fn();
    const { strokesRef, layerRef } = refs();
    const { result, rerender } = renderHook(
      ({ k }) => usePageDraw(k, strokesRef, layerRef, 0, push),
      {
        initialProps: { k: 'worship_docdraw_song4_v1_0' },
      },
    );
    // Text auf Seite A anlegen (wird persistiert).
    act(() => result.current.placeText(0.4, 0.4, 10, 10));
    act(() => result.current.confirmText('Seite A', '#000', 2, DEFAULT_TEXT_STYLE));
    expect(result.current.texts).toHaveLength(1);
    // Auf Seite B wechseln → leer.
    rerender({ k: 'worship_docdraw_song4_v1_1' });
    expect(result.current.texts).toHaveLength(0);
    // Zurück auf Seite A → Text wieder da.
    rerender({ k: 'worship_docdraw_song4_v1_0' });
    expect(result.current.texts).toHaveLength(1);
    expect(result.current.texts[0].text).toBe('Seite A');
  });
});
