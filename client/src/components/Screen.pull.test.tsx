// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Scroll } from './Screen';

/**
 * „Runterziehen zum Aktualisieren" – der Hinweis erscheint NUR während der Geste (22.09.2026).
 *
 * Vorher stand er als dauerhafte Zeile am Listenanfang. In Bildschirmen ohne Kopfleiste (Termine)
 * lag er damit im Unschärfe-Band von iOS 26/27 und war verschwommen – Alwin: „Den Hinweis z. B.
 * nur einblenden, wenn man auch runterzieht?" Genau das prüft dieser Test: in Ruhe nichts, beim
 * Ziehen der Text, am Auslösepunkt der andere Wortlaut, beim Loslassen das Neuladen.
 *
 * Der Hook dämpft den Zug auf die Hälfte (`delta * 0.5`) und löst ab 70 px aus – die Zahlen hier
 * sind daraus abgeleitet, nicht geraten.
 */
function ziehen(el: HTMLElement, bis: number) {
  fireEvent.touchStart(el, { touches: [{ clientY: 0 }] });
  fireEvent.touchMove(el, { touches: [{ clientY: bis }] });
}

const hinweis = () => screen.queryByText(/Zum Aktualisieren nach unten ziehen/);
const loslassen = () => screen.queryByText(/Loslassen zum Aktualisieren/);
const sichtbar = (el: HTMLElement | null) => el !== null && getComputedStyle(el).opacity !== '0';

describe('Scroll mit onRefresh – der Hinweis zum Ziehen', () => {
  it('zeigt in Ruhe keinen Hinweis', () => {
    render(
      <Scroll onRefresh={() => {}}>
        <div>Inhalt</div>
      </Scroll>,
    );
    expect(sichtbar(hinweis())).toBe(false);
    expect(loslassen()).toBeNull();
  });

  it('blendet den Hinweis ein, sobald man deutlich zieht', () => {
    const { container } = render(
      <Scroll onRefresh={() => {}}>
        <div>Inhalt</div>
      </Scroll>,
    );
    const scroller = container.firstElementChild as HTMLElement;
    ziehen(scroller, 80); // gedämpft 40 px → über der Sichtbarkeitsschwelle von 28
    expect(sichtbar(hinweis())).toBe(true);
    expect(loslassen()).toBeNull();
  });

  it('wechselt am Auslösepunkt den Wortlaut und lädt beim Loslassen neu', () => {
    const onRefresh = vi.fn();
    const { container } = render(
      <Scroll onRefresh={onRefresh}>
        <div>Inhalt</div>
      </Scroll>,
    );
    const scroller = container.firstElementChild as HTMLElement;
    ziehen(scroller, 160); // gedämpft 80 px → über der Auslöseschwelle von 70
    expect(sichtbar(loslassen())).toBe(true);
    expect(hinweis()).toBeNull();
    fireEvent.touchEnd(scroller);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('ohne onRefresh gibt es weder Hinweis noch Geste', () => {
    render(
      <Scroll>
        <div>Inhalt</div>
      </Scroll>,
    );
    expect(hinweis()).toBeNull();
  });
});
