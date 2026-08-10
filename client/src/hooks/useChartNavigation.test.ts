// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import type { StreamOwner } from '../utils/streamCompose';

/**
 * #314: Das Blättern im durchgehenden Strom war ungetestet, obwohl es die schwierigste Rechnung der
 * Chart-Ansicht enthält – die **Querformat-Grenze**.
 *
 * Im Querformat stehen zwei Seiten nebeneinander. Die linke Seite darf deshalb höchstens die
 * vorletzte sein, sonst stünde die letzte Seite allein und rechts wäre ein Loch. Dieselbe Grenze
 * gilt beim Sprung zu einem Lied und beim SCHRUMPFEN des Stroms: Stellt jemand ein Lied auf zwei
 * Spalten und es hat plötzlich eine Seite weniger, muss das Fenster nachrutschen.
 */
const landscape = vi.fn(() => false);
vi.mock('./useLandscape', () => ({ useLandscape: () => landscape() }));

const { useChartNavigation } = await import('./useChartNavigation');

/** `n` Seiten, verteilt auf Lieder gemäß `proLied`. */
function owners(proLied: number[]): StreamOwner[] {
  const list: StreamOwner[] = [];
  proLied.forEach((seiten, songIdx) => {
    for (let p = 0; p < seiten; p++) {
      list.push({
        songIdx,
        songId: 100 + songIdx,
        localPage: p,
        arrangementId: 45,
        kind: 'chord',
        versionKey: 'original',
      });
    }
  });
  return list;
}

const blocked = () => createRef<boolean>() as { current: boolean };

function starte(o: StreamOwner[], startIndex = 0, blockedRef = { current: false }) {
  return renderHook(
    (p: { o: StreamOwner[] }) => useChartNavigation({ owners: p.o, startIndex, blockedRef }),
    { initialProps: { o } },
  );
}

beforeEach(() => {
  landscape.mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useChartNavigation – Blättern im Hochformat', () => {
  it('beginnt vorn und meldet das auch', () => {
    const { result } = starte(owners([2, 2]));
    expect(result.current.pageIdx).toBe(0);
    expect(result.current.atStart).toBe(true);
    expect(result.current.atEnd).toBe(false);
  });

  it('blättert um EINE Seite und nimmt die aktive Seite mit', () => {
    const { result } = starte(owners([2, 2]));
    act(() => result.current.next());
    expect(result.current.pageIdx).toBe(1);
    expect(result.current.activeIdx).toBe(1);
    act(() => result.current.prev());
    expect(result.current.pageIdx).toBe(0);
  });

  it('läuft an den Enden nicht darüber hinaus', () => {
    const { result } = starte(owners([2]));
    act(() => result.current.prev());
    expect(result.current.pageIdx).toBe(0);
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.pageIdx).toBe(1);
    expect(result.current.atEnd).toBe(true);
  });
});

describe('useChartNavigation – die Querformat-Grenze', () => {
  it('lässt die letzte Seite nie allein links stehen', () => {
    landscape.mockReturnValue(true);
    const { result } = starte(owners([2, 2])); // 4 Seiten → linke Seite höchstens 2
    act(() => result.current.setPage(3));
    expect(result.current.pageIdx).toBe(2);
    expect(result.current.atEnd).toBe(true);
  });

  it('rutscht aufs letzte volle Paar, wenn der Strom schrumpft', () => {
    landscape.mockReturnValue(true);
    const { result, rerender } = starte(owners([2, 2]));
    act(() => result.current.setPage(2));
    expect(result.current.pageIdx).toBe(2);
    // Ein Lied fällt von zwei auf eine Seite (z. B. auf zwei Spalten umgestellt).
    rerender({ o: owners([1, 2]) });
    expect(result.current.pageIdx).toBe(1); // 3 Seiten → höchstens 1
  });

  it('kennt im Hochformat diese Grenze nicht', () => {
    const { result } = starte(owners([2, 2]));
    act(() => result.current.setPage(3));
    expect(result.current.pageIdx).toBe(3);
  });
});

describe('useChartNavigation – Sprung zum Lied', () => {
  it('springt beim Öffnen auf das gewünschte Lied', () => {
    const { result } = starte(owners([2, 2]), 1);
    expect(result.current.activeIdx).toBe(2);
  });

  it('springt nur EINMAL – späteres Blättern wird nicht zurückgeworfen', () => {
    const { result, rerender } = starte(owners([2, 2]), 1);
    act(() => result.current.next());
    expect(result.current.pageIdx).toBe(3);
    rerender({ o: owners([2, 2, 1]) }); // Strom ändert sich, der Start-Sprung ist durch
    expect(result.current.pageIdx).toBe(3);
  });

  it('lässt das Ziel-Lied im Querformat notfalls rechts stehen', () => {
    landscape.mockReturnValue(true);
    const { result } = starte(owners([2, 1]), 1); // 3 Seiten, Ziel ist Seite 2
    expect(result.current.activeIdx).toBe(2); // aktiv ist das Ziel …
    expect(result.current.pageIdx).toBe(1); // … links steht sein Vorgänger
  });

  it('tut bei einem Lied nichts, das gar nicht im Strom steht', () => {
    const { result } = starte(owners([2]), 5);
    expect(result.current.pageIdx).toBe(0);
  });
});

describe('useChartNavigation – Tastatur', () => {
  it('blättert mit ← und →', () => {
    const { result } = starte(owners([3]));
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })));
    expect(result.current.pageIdx).toBe(1);
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' })));
    expect(result.current.pageIdx).toBe(0);
  });

  it('schweigt, solange Editor oder Zeichenmodus offen sind', () => {
    const gesperrt = blocked();
    gesperrt.current = true;
    const { result } = starte(owners([3]), 0, gesperrt);
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })));
    expect(result.current.pageIdx).toBe(0);
  });

  it('lässt Pfeiltasten in Eingabefeldern in Ruhe', () => {
    const { result } = starte(owners([3]));
    const feld = document.createElement('input');
    document.body.appendChild(feld);
    act(() => {
      const e = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      feld.dispatchEvent(e);
    });
    expect(result.current.pageIdx).toBe(0);
    feld.remove();
  });

  it('meldet den Tastatur-Listener beim Verlassen wieder ab', () => {
    const { result, unmount } = starte(owners([3]));
    unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(result.current.pageIdx).toBe(0);
  });
});
