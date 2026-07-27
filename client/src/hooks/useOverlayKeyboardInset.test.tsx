// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useRef } from 'react';
import { useOverlayKeyboardInset } from './useOverlayKeyboardInset';

/**
 * Mechanik der Tastatur-Aussparung (#207). Der eigentliche Effekt ist iOS-spezifisch, aber die
 * Rechnung, das Aufräumen und das Verhalten ohne `visualViewport` sind hier prüfbar.
 */
function Overlay() {
  const ref = useRef<HTMLDivElement>(null);
  useOverlayKeyboardInset(ref);
  return <div ref={ref} data-testid="overlay" />;
}

interface FakeVv {
  height: number;
  offsetTop: number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

function stubViewport(height: number, offsetTop = 0): FakeVv {
  const vv: FakeVv = {
    height,
    offsetTop,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  return vv;
}

afterEach(() => {
  cleanup(); // sonst stapeln sich die gerenderten Overlays über die Tests hinweg
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  vi.restoreAllMocks();
});

describe('useOverlayKeyboardInset', () => {
  it('setzt --kb auf die Höhe der Tastatur', () => {
    window.innerHeight = 800;
    stubViewport(500); // 800 - 500 - 0 = 300px Tastatur
    const { getByTestId } = render(<Overlay />);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('300px');
  });

  it('ohne Tastatur ist --kb 0 (nie negativ)', () => {
    window.innerHeight = 800;
    stubViewport(900); // größer als innerHeight → darf nicht negativ werden
    const { getByTestId } = render(<Overlay />);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('0px');
  });

  it('rechnet den vom Browser verschobenen Viewport mit ein', () => {
    window.innerHeight = 800;
    stubViewport(500, 100); // 800 - 500 - 100 = 200px
    const { getByTestId } = render(<Overlay />);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('200px');
  });

  it('hört auf Viewport-Änderungen und meldet sich beim Schließen wieder ab', () => {
    window.innerHeight = 800;
    const vv = stubViewport(500);
    const { unmount } = render(<Overlay />);
    expect(vv.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(vv.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    unmount();
    expect(vv.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(vv.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('holt beim Schließen den Dokument-Scroll zurück', () => {
    window.innerHeight = 800;
    stubViewport(500);
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { value: scrollTo, configurable: true });
    const { unmount } = render(<Overlay />);
    scrollTo.mockClear();
    unmount();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('ohne visualViewport passiert nichts (kein Absturz, kein --kb)', () => {
    const { getByTestId } = render(<Overlay />);
    expect(getByTestId('overlay').style.getPropertyValue('--kb')).toBe('');
  });
});
