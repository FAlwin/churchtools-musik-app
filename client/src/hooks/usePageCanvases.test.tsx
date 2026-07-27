// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { useMemo } from 'react';
import { renderHook, act } from '@testing-library/react';
import { usePageCanvases } from './usePageCanvases';
import { joinKeys, splitKeys } from '../utils/pageKeys';

/**
 * #193: Dieser Effekt malt die sichtbaren Seiten und lädt ihre Striche. Er ist der Grund, warum
 * die Datei früher `exhaustive-deps` abgeschaltet hatte – und enthielt dadurch eine stille Lücke:
 * Änderte sich ein Anmerkungs-Schlüssel, ohne dass Seitenindex oder Sync-Zähler sich bewegten,
 * blieb der ALTE Strich-Stand stehen. Genau das prüfen die Tests hier.
 *
 * jsdom hat keine echte Zeichenfläche → `getContext` wird gestubbt. Getestet wird der **Vertrag**
 * (was wird aus dem Speicher gelesen, welches Bild wird gesetzt, welches Seitenverhältnis kommt
 * heraus), nicht das gemalte Ergebnis.
 */
type Ctx = { drawImage: Mock; clearRect: Mock };

function ctx(): Ctx {
  return { drawImage: vi.fn(), clearRect: vi.fn() };
}

/** Canvas-Attrappe mit gestubbtem 2D-Kontext. */
function canvas(width = 100, height = 200) {
  const c = document.createElement('canvas');
  const c2d = ctx();
  c.getContext = (() => c2d) as unknown as HTMLCanvasElement['getContext'];
  Object.defineProperty(c, '__ctx', { value: c2d });
  c.width = width;
  c.height = height;
  return c;
}

function refPair() {
  return [{ current: canvas() }, { current: canvas() }];
}

/** Alle `src`-Werte, die während des Laufs auf ein `new Image()` gesetzt wurden. */
let imageSources: string[] = [];

beforeEach(() => {
  localStorage.clear();
  imageSources = [];
  class FakeImage {
    onload: (() => void) | null = null;
    naturalWidth = 1;
    complete = true;
    #src = '';
    set src(v: string) {
      this.#src = v;
      imageSources.push(v);
    }
    get src() {
      return this.#src;
    }
  }
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Ruft den Hook mit sinnvollen Vorgaben auf; `over` überschreibt einzelne Werte. */
function setup(over: Record<string, unknown> = {}) {
  const contentRefs = refPair();
  const annoRefs = refPair();
  const overlayRefs = refPair();
  const pages = [canvas(1240, 1754), canvas(1240, 1754), canvas(800, 600)];
  const onAfterPaint = vi.fn();

  const base = {
    pages,
    pageIndex: 0,
    perView: 1,
    loading: false,
    syncTick: 0,
    remountEpoch: 0,
    ownSig: joinKeys(['eigen_0', null]),
    overSig: joinKeys([null, null]),
    neighbourSig: joinKeys([]),
    ...over,
  };

  // Wrapper wie in PageDeck: die Schlüssel-Arrays bekommen über die Signatur eine stabile
  // Identität. Ohne das liefe der Effekt bei JEDEM Render – der Hook hält das inzwischen aus,
  // aber getestet werden soll das echte Zusammenspiel.
  function useSubject(p: typeof base) {
    const ownKeys = useMemo(() => splitKeys(p.ownSig), [p.ownSig]);
    const overKeys = useMemo(() => splitKeys(p.overSig), [p.overSig]);
    const neighbourKeys = useMemo(() => splitKeys(p.neighbourSig), [p.neighbourSig]);
    return usePageCanvases({
      pages: p.pages,
      pageIndex: p.pageIndex,
      perView: p.perView,
      loading: p.loading,
      syncTick: p.syncTick,
      remountEpoch: p.remountEpoch,
      ownKeys,
      overKeys,
      neighbourKeys,
      contentRefs,
      annoRefs,
      overlayRefs,
      onAfterPaint,
    });
  }

  const view = renderHook(useSubject, { initialProps: base });
  return { view, base, contentRefs, annoRefs, overlayRefs, pages, onAfterPaint };
}

describe('usePageCanvases – Seiten malen', () => {
  it('übernimmt die Maße der Quellseite und meldet ihr Seitenverhältnis', () => {
    const { view, annoRefs } = setup();
    expect(annoRefs[0].current.width).toBe(1240);
    expect(annoRefs[0].current.height).toBe(1754);
    expect(view.result.current.aspects[0]).toBe('1240 / 1754');
  });

  it('lädt die gespeicherten Striche der sichtbaren Seite', () => {
    localStorage.setItem('eigen_0', 'data:image/png;base64,STRICHE');
    setup();
    expect(imageSources).toContain('data:image/png;base64,STRICHE');
  });

  it('ohne Schlüssel (null) wird kein Strich-Bild geladen', () => {
    localStorage.setItem('eigen_0', 'data:image/png;base64,STRICHE');
    setup({ ownSig: joinKeys([null, null]) });
    expect(imageSources).toHaveLength(0);
  });

  it('während des Ladens passiert gar nichts', () => {
    localStorage.setItem('eigen_0', 'data:image/png;base64,STRICHE');
    const { onAfterPaint } = setup({ loading: true });
    expect(imageSources).toHaveLength(0);
    expect(onAfterPaint).not.toHaveBeenCalled();
  });

  it('im Querformat werden BEIDE Seiten bedient', () => {
    localStorage.setItem('eigen_0', 'a');
    localStorage.setItem('eigen_1', 'b');
    const { view } = setup({ perView: 2, ownSig: joinKeys(['eigen_0', 'eigen_1']) });
    expect(imageSources.sort()).toEqual(['a', 'b']);
    expect(view.result.current.aspects[1]).toBe('1240 / 1754');
  });

  it('zeichnet die fremde Ebene auf die eigene Overlay-Canvas', () => {
    localStorage.setItem('fremd_0', 'data:image/png;base64,FREMD');
    setup({ overSig: joinKeys(['fremd_0', null]) });
    expect(imageSources).toContain('data:image/png;base64,FREMD');
  });

  it('stellt nach dem Neuzeichnen den gespeicherten Zoom wieder her', () => {
    const { onAfterPaint } = setup();
    expect(onAfterPaint).toHaveBeenCalled();
  });
});

describe('usePageCanvases – wann neu gezeichnet wird', () => {
  it('EIN GEÄNDERTER SCHLÜSSEL löst neu zeichnen aus (die alte stille Lücke)', () => {
    localStorage.setItem('eigen_0', 'alt');
    localStorage.setItem('anders_0', 'neu');
    const { view, base } = setup();
    expect(imageSources).toEqual(['alt']);

    // Seitenindex und Sync-Zähler bleiben gleich – NUR der Schlüssel wechselt (so wie beim
    // Umschalten auf „Nur Text": anderer Namensraum, gleiche Seite).
    act(() => view.rerender({ ...base, ownSig: joinKeys(['anders_0', null]) }));
    expect(imageSources).toEqual(['alt', 'neu']);
  });

  it('ein Render ohne Änderung zeichnet NICHT neu (sonst flackerte es dauernd)', () => {
    localStorage.setItem('eigen_0', 'alt');
    const { view, base } = setup();
    act(() => view.rerender({ ...base }));
    expect(imageSources).toEqual(['alt']);
  });

  it('ein Sync-Zähler-Wechsel liest den Speicher neu (Striche kamen vom Server)', () => {
    localStorage.setItem('eigen_0', 'alt');
    const { view, base } = setup();
    localStorage.setItem('eigen_0', 'vom-server');
    act(() => view.rerender({ ...base, syncTick: 1 }));
    expect(imageSources).toEqual(['alt', 'vom-server']);
  });
});

describe('usePageCanvases – Bild-Vorrat der Nachbarseiten', () => {
  it('dekodiert die Nachbar-Striche vorab (der Slide-Streifen braucht sie sofort)', () => {
    localStorage.setItem('nachbar_1', 'data:image/png;base64,N1');
    const { view } = setup({ neighbourSig: joinKeys(['nachbar_1', null]) });
    expect(view.result.current.strokeImgCache.current.get('nachbar_1')?.src).toBe(
      'data:image/png;base64,N1',
    );
  });

  it('entfernt Einträge, deren Striche gelöscht wurden', () => {
    localStorage.setItem('nachbar_1', 'x');
    const { view, base } = setup({ neighbourSig: joinKeys(['nachbar_1']) });
    expect(view.result.current.strokeImgCache.current.has('nachbar_1')).toBe(true);

    localStorage.removeItem('nachbar_1');
    act(() => view.rerender({ ...base, neighbourSig: joinKeys(['nachbar_1']), syncTick: 1 }));
    expect(view.result.current.strokeImgCache.current.has('nachbar_1')).toBe(false);
  });

  it('hält den Vorrat bei 40 Einträgen gedeckelt', () => {
    const keys = Array.from({ length: 60 }, (_, i) => `n${i}`);
    keys.forEach((k) => localStorage.setItem(k, `d-${k}`));
    const { view } = setup({ neighbourSig: joinKeys(keys) });
    expect(view.result.current.strokeImgCache.current.size).toBe(40);
    // Die ÄLTESTEN fliegen zuerst → die zuletzt eingefügten sind noch da.
    expect(view.result.current.strokeImgCache.current.has('n59')).toBe(true);
    expect(view.result.current.strokeImgCache.current.has('n0')).toBe(false);
  });
});
