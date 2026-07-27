// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PageTextLayer } from './PageTextLayer';
import { DEFAULT_TEXT_STYLE, type PageTextObj, type usePageDraw } from '../hooks/usePageDraw';

/**
 * #193: Die Text-Ebene war ~140 Zeilen JSX mitten in `PageDeck` und damit ungetestet. Geprüft wird
 * hier vor allem, was man am Gerät leicht übersieht: WANN Text anfassbar ist. Zwei Regeln hängen
 * daran – mit Stift/Marker muss man ungehindert ÜBER Text zeichnen können, und im Querformat darf
 * nur die aktive Hälfte reagieren (#53), sonst wählt ein Tipp auf die ausgegraute Seite einen Text
 * aus, statt die Seite zu aktivieren.
 */
type PageDraw = ReturnType<typeof usePageDraw>;

function text(over: Partial<PageTextObj> = {}): PageTextObj {
  return { id: 1, fx: 0.5, fy: 0.5, text: 'Mein Text', color: '#000000', sizeCqh: 2, ...over };
}

function draw(over: Partial<PageDraw> = {}): PageDraw {
  return {
    texts: [],
    selectedId: null,
    setSelectedId: vi.fn(),
    pending: null,
    canUndo: false,
    canRedo: false,
    hasAnnotations: false,
    pushHistory: vi.fn(),
    dropHistory: vi.fn(),
    saveStrokes: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    placeText: vi.fn(),
    confirmText: vi.fn(),
    cancelText: vi.fn(),
    editText: vi.fn(),
    deleteText: vi.fn(),
    setColor: vi.fn(),
    setStyle: vi.fn(),
    resize: vi.fn(),
    setSize: vi.fn(),
    startDrag: vi.fn(),
    moveDrag: vi.fn(),
    endDrag: vi.fn(),
    clearAll: vi.fn(),
    ...over,
  } as unknown as PageDraw;
}

function renderLayer(over: Record<string, unknown> = {}) {
  const props = {
    draw: draw(),
    layerRef: { current: null },
    editRef: vi.fn(),
    aspect: '1240 / 1754',
    overlayTexts: [] as PageTextObj[],
    showOwn: true,
    drawMode: true,
    drawTool: 'text' as const,
    interactive: true,
    drawColor: '#000000',
    textSize: 2,
    textStyle: DEFAULT_TEXT_STYLE,
    onLayerDown: vi.fn(),
    onCommit: vi.fn(),
    onFocusEditor: vi.fn(),
    onResizeDown: vi.fn(),
    onResizeMove: vi.fn(),
    onResizeUp: vi.fn(),
    ...over,
  };
  return render(<PageTextLayer {...props} />);
}

afterEach(cleanup);

describe('PageTextLayer – was gezeigt wird', () => {
  it('zeigt die eigenen Texte', () => {
    renderLayer({ draw: draw({ texts: [text({ text: 'Einsatz Bass' })] }) });
    expect(screen.getByText('Einsatz Bass')).toBeTruthy();
  });

  it('verbirgt die eigenen Texte beim Ansehen einer fremden Ebene', () => {
    renderLayer({ draw: draw({ texts: [text({ text: 'Meins' })] }), showOwn: false });
    expect(screen.queryByText('Meins')).toBeNull();
  });

  it('zeigt fremde Texte IMMER – auch zusammen mit den eigenen (Zusammenführen-Vorschau)', () => {
    renderLayer({
      draw: draw({ texts: [text({ id: 1, text: 'Meins' })] }),
      overlayTexts: [text({ id: 9, text: 'Von Anna' })],
      showOwn: true,
    });
    expect(screen.getByText('Von Anna')).toBeTruthy();
    expect(screen.getByText('Meins')).toBeTruthy();
  });

  it('fremde Texte sind nie anfassbar (sie gehören jemand anderem)', () => {
    renderLayer({ overlayTexts: [text({ text: 'Von Anna' })] });
    expect(screen.getByText('Von Anna').style.pointerEvents).toBe('none');
  });

  it('ersetzt den gerade bearbeiteten Text durch die Inline-Eingabe (kein doppelter Text)', () => {
    const { container } = renderLayer({
      draw: draw({
        texts: [text({ id: 4, text: 'Wird bearbeitet' })],
        pending: { fx: 0.5, fy: 0.5, cx: 0, cy: 0, editId: 4, initial: 'Wird bearbeitet' },
      }),
    });
    // Der Text steht GENAU EINMAL da – und zwar als Eingabefeld, nicht zusätzlich als fester Text.
    const treffer = screen.getAllByText('Wird bearbeitet');
    expect(treffer).toHaveLength(1);
    expect(treffer[0].getAttribute('contenteditable')).toBe('true');
    expect(container.querySelectorAll('[contenteditable]')).toHaveLength(1);
  });
});

describe('PageTextLayer – wann Text anfassbar ist', () => {
  it('mit dem Text-Werkzeug auf der aktiven Seite: ja', () => {
    renderLayer({ draw: draw({ texts: [text()] }), drawTool: 'text', interactive: true });
    expect(screen.getByText('Mein Text').style.pointerEvents).toBe('all');
  });

  it('mit dem Stift: nein – darüber muss man zeichnen können', () => {
    renderLayer({ draw: draw({ texts: [text()] }), drawTool: 'pen' });
    expect(screen.getByText('Mein Text').style.pointerEvents).toBe('none');
  });

  it('auf der INAKTIVEN Hälfte im Querformat: nein (#53 – der Tipp aktiviert die Seite)', () => {
    renderLayer({ draw: draw({ texts: [text()] }), drawTool: 'text', interactive: false });
    expect(screen.getByText('Mein Text').style.pointerEvents).toBe('none');
  });

  it('außerhalb des Anmerkungsmodus ist die ganze Ebene durchlässig', () => {
    const { container } = renderLayer({ drawMode: false });
    const layer = container.firstElementChild as HTMLElement;
    expect(layer.style.pointerEvents).toBe('none');
  });
});

describe('PageTextLayer – Auswahl und Zieh-Knopf', () => {
  it('der Zieh-Knopf erscheint nur am AUSGEWÄHLTEN Text', () => {
    renderLayer({ draw: draw({ texts: [text({ id: 1 })], selectedId: null }) });
    expect(screen.queryByLabelText('Textgröße ändern')).toBeNull();

    cleanup();
    renderLayer({ draw: draw({ texts: [text({ id: 1 })], selectedId: 1 }) });
    expect(screen.getByLabelText('Textgröße ändern')).toBeTruthy();
  });

  it('und nicht, wenn gerade nicht das Text-Werkzeug aktiv ist', () => {
    renderLayer({ draw: draw({ texts: [text({ id: 1 })], selectedId: 1 }), drawTool: 'marker' });
    expect(screen.queryByLabelText('Textgröße ändern')).toBeNull();
  });
});

describe('PageTextLayer – Inline-Eingabe', () => {
  it('übernimmt den Startinhalt beim Bearbeiten', () => {
    const { container } = renderLayer({
      draw: draw({
        texts: [text({ id: 4, text: 'Alt' })],
        pending: { fx: 0.2, fy: 0.3, cx: 0, cy: 0, editId: 4, initial: 'Alt' },
      }),
    });
    expect((container.querySelector('[contenteditable]') as HTMLElement).textContent).toBe('Alt');
  });

  it('startet bei einem NEUEN Text leer und an der Tipp-Stelle', () => {
    const { container } = renderLayer({
      draw: draw({ pending: { fx: 0.25, fy: 0.75, cx: 0, cy: 0, initial: '' } }),
    });
    const el = container.querySelector('[contenteditable]') as HTMLElement;
    expect(el.textContent).toBe('');
    expect(el.style.left).toBe('25%');
    expect(el.style.top).toBe('75%');
  });

  it('meldet das Eingabe-Element nach oben (die Tastatur-Logik braucht es)', () => {
    const editRef = vi.fn();
    renderLayer({
      draw: draw({ pending: { fx: 0.5, fy: 0.5, cx: 0, cy: 0, initial: '' } }),
      editRef,
    });
    expect(editRef).toHaveBeenCalledWith(expect.any(HTMLElement));
  });
});
