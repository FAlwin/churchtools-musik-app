// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from './useSettings';

/**
 * **Die Farbe der Systemleiste muss dem Theme der APP folgen, nicht dem des Geräts.**
 *
 * Unter iOS malt das System den Streifen über der App (Statusleiste) in der `theme-color`; seit
 * 22.09.2026 beginnt die App darunter, damit Liquid Glass ihren Titel nicht verschmiert
 * (siehe `client/index.html`). Läuft diese Farbe vom tatsächlichen Theme weg, sitzt oben ein
 * andersfarbiger Balken – genau die Kante, die Alwin dreimal gemeldet hat.
 *
 * Der gefährliche Fall ist NICHT „beides dunkel", sondern **App hell bei dunklem Gerät**: Eine
 * `prefers-color-scheme`-Medienabfrage im Meta-Tag hätte dort Dunkel gewählt, während die App weiß
 * ist. Deshalb liest der Hook den Wert aus `--nav-bg` – der einen Quelle der Leistenfarbe.
 */
function setzeSystem(dunkel: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: dunkel && q.includes('dark'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
  document.documentElement.removeAttribute('data-theme');
  // In jsdom gibt es kein SCSS – die Variable wird gesetzt wie im echten Stylesheet.
  document.documentElement.style.setProperty('--nav-bg', '#ffffff');
});

const farbe = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content');

describe('useSettings – die Farbe der Systemleiste', () => {
  it('folgt dem hellen App-Theme, AUCH wenn das Gerät dunkel steht', () => {
    setzeSystem(true);
    localStorage.setItem('worship_theme', JSON.stringify('light'));
    renderHook(() => useSettings());

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(farbe()).toBe('#ffffff');
  });

  it('nimmt den Wert aus `--nav-bg` und nicht aus einer zweiten Farbliste', () => {
    setzeSystem(false);
    document.documentElement.style.setProperty('--nav-bg', '#123456');
    renderHook(() => useSettings());

    expect(farbe()).toBe('#123456');
  });

  it('zieht beim Umschalten des Themes mit', () => {
    setzeSystem(false);
    const { result } = renderHook(() => useSettings());
    expect(farbe()).toBe('#ffffff');

    // Dunkles Theme wählen – im echten Betrieb ändert das die SCSS-Variable.
    document.documentElement.style.setProperty('--nav-bg', '#1e2a35');
    act(() => result.current.setThemePref('dark'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(farbe()).toBe('#1e2a35');
  });
});
