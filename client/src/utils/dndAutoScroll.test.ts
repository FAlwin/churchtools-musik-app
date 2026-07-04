// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { innerScrollOnly, resetViewportAfterDrag } from './dndAutoScroll';

// Regressionstests zu #56: dnd-kit-AutoScroll darf nie das Dokument scrollen (sonst rutscht
// die Kopfleiste der absolut positionierten .screen aus dem Bild – iOS-PWA).
describe('innerScrollOnly.canScroll', () => {
  it('verbietet Dokument-Ebenen (scrollingElement, html, body)', () => {
    expect(innerScrollOnly.canScroll(document.documentElement)).toBe(false);
    expect(innerScrollOnly.canScroll(document.body)).toBe(false);
    if (document.scrollingElement) {
      expect(innerScrollOnly.canScroll(document.scrollingElement)).toBe(false);
    }
  });

  it('erlaubt innere Scroll-Container (z. B. die .scroll-Div)', () => {
    const inner = document.createElement('div');
    document.body.appendChild(inner);
    expect(innerScrollOnly.canScroll(inner)).toBe(true);
  });
});

describe('resetViewportAfterDrag', () => {
  it('setzt den Dokument-Scroll zurück und stößt syncAppHeight (resize) an', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const dispatched: string[] = [];
    const dispatch = vi
      .spyOn(window, 'dispatchEvent')
      .mockImplementation((e) => (dispatched.push(e.type), true));

    resetViewportAfterDrag();

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(dispatched).toContain('resize');

    scrollTo.mockRestore();
    dispatch.mockRestore();
  });
});
