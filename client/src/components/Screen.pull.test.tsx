// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

/**
 * **Die Ladeanzeige muss zum Neuladen passen** (Alwin, 22.09.2026: „bei Abwesenheit und Termine ist
 * das Neuladen nicht richtig. Bei Lied stimmt es.").
 *
 * Zwei Regeln, zwei Tests – bewusst getrennt, denn sie decken einander sonst zu:
 *  1. Dauert der Abruf lange, steht die Anzeige so lange. Das fängt den Fehler der Abwesenheiten,
 *     deren Neuladen zwei Abrufe wegwarf und sofort zurückkam. Der Abruf hier braucht deutlich
 *     länger als die Untergrenze – sonst wäre der Test auch ohne den Fix grün.
 *  2. Kommt die Antwort aus dem Cache, blitzt die Anzeige nicht nur auf, sondern bleibt kurz stehen.
 *
 * Gemessen wird die Höhe des Anzeigebands (48 px, solange geladen wird) – unabhängig von den
 * Klassennamen der CSS-Module.
 */
const band = (container: HTMLElement) =>
  (container.firstElementChild as HTMLElement).firstElementChild as HTMLElement;

describe('Scroll mit onRefresh – wie lange die Ladeanzeige steht', () => {
  afterEach(() => vi.useRealTimers());

  async function ziehenUndLoslassen(onRefresh: () => Promise<unknown>) {
    vi.useFakeTimers();
    const { container } = render(
      <Scroll onRefresh={onRefresh}>
        <div>Inhalt</div>
      </Scroll>,
    );
    const scroller = container.firstElementChild as HTMLElement;
    ziehen(scroller, 160);
    await act(async () => {
      fireEvent.touchEnd(scroller);
    });
    return container;
  }

  it('bleibt sichtbar, solange der Abruf läuft', async () => {
    let fertig!: () => void;
    const container = await ziehenUndLoslassen(
      () =>
        new Promise<void>((aufloesen) => {
          fertig = aufloesen;
        }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(band(container).style.height).toBe('48px');

    await act(async () => {
      fertig();
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(band(container).style.height).toBe('0px');
  });

  it('blitzt bei einer sofortigen Antwort nicht nur auf', async () => {
    const container = await ziehenUndLoslassen(() => Promise.resolve());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(band(container).style.height).toBe('48px');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(band(container).style.height).toBe('0px');
  });
});
