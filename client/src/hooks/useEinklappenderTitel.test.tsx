// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useEinklappenderTitel } from './useEinklappenderTitel';
import { GrosseUeberschrift } from '../components/GrosseUeberschrift';
import { NavBar } from '../components/NavBar';

/**
 * Große Überschrift im Inhalt, Titel klappt beim Scrollen in die Leiste (iOS-Muster, 22.09.2026).
 *
 * jsdom kennt keinen `IntersectionObserver` – hier steht eine Attrappe, die den Rückruf festhält,
 * damit der Test „Überschrift verschwindet" und „kommt wieder" selbst auslösen kann. Geprüft wird
 * die ganze Kette bis in die Leiste: Wer den Hook auskoppelt oder `titelSichtbar` ignoriert, lässt
 * diese Tests fallen.
 */
type Rueckruf = (eintraege: Array<{ isIntersecting: boolean }>) => void;
let rueckruf: Rueckruf | null = null;
let beobachtet: Element[] = [];
let getrennt = 0;
let optionen: IntersectionObserverInit | undefined;

class BeobachterAttrappe {
  constructor(cb: Rueckruf, opt?: IntersectionObserverInit) {
    rueckruf = cb;
    optionen = opt;
  }
  observe(el: Element) {
    beobachtet.push(el);
  }
  disconnect() {
    getrennt += 1;
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
}

function Seite() {
  const { refUeberschrift, eingeklappt } = useEinklappenderTitel(56);
  return (
    <>
      <NavBar title="Termine" titelSichtbar={eingeklappt} />
      <GrosseUeberschrift innerRef={refUeberschrift}>Termine</GrosseUeberschrift>
    </>
  );
}

const leistenTitel = () => screen.getAllByText('Termine')[0].closest('[class*="titles"]')!;

beforeEach(() => {
  rueckruf = null;
  beobachtet = [];
  getrennt = 0;
  vi.stubGlobal('IntersectionObserver', BeobachterAttrappe);
});
afterEach(() => vi.unstubAllGlobals());

describe('useEinklappenderTitel', () => {
  it('beobachtet die große Überschrift, mit der Leistenhöhe als oberem Rand', () => {
    render(<Seite />);
    expect(beobachtet).toHaveLength(1);
    expect(beobachtet[0].tagName).toBe('H1');
    expect(optionen?.rootMargin).toBe('-56px 0px 0px 0px');
  });

  it('im Ruhezustand ist der Titel in der Leiste unsichtbar – die Überschrift steht im Inhalt', () => {
    render(<Seite />);
    expect(leistenTitel().className).toMatch(/titelVersteckt/);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Termine');
  });

  it('verschwindet die Überschrift nach oben, erscheint der Titel in der Leiste', () => {
    render(<Seite />);
    act(() => rueckruf!([{ isIntersecting: false }]));
    expect(leistenTitel().className).not.toMatch(/titelVersteckt/);
  });

  it('kommt die Überschrift zurück, verschwindet der Leistentitel wieder', () => {
    render(<Seite />);
    act(() => rueckruf!([{ isIntersecting: false }]));
    act(() => rueckruf!([{ isIntersecting: true }]));
    expect(leistenTitel().className).toMatch(/titelVersteckt/);
  });

  it('räumt den Beobachter beim Verschwinden der Seite ab', () => {
    const { unmount } = render(<Seite />);
    unmount();
    expect(getrennt).toBeGreaterThan(0);
  });

  it('ohne IntersectionObserver bleibt der Titel einfach sichtbar', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Seite />);
    expect(leistenTitel().className).not.toMatch(/titelVersteckt/);
  });
});

describe('NavBar ohne das Muster', () => {
  it('zeigt den Titel wie bisher immer – `titelSichtbar` ist optional', () => {
    render(<NavBar title="Lieder" />);
    expect(screen.getByText('Lieder').closest('[class*="titles"]')!.className).not.toMatch(
      /titelVersteckt/,
    );
  });
});
