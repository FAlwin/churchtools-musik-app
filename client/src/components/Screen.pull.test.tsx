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

/** Der Anzeiger hängt seit dem 22.09.2026 NEBEN dem Scroll-Bereich, nicht darin. */
const scrollBereich = (container: HTMLElement) =>
  container.querySelector('[class*="scroll"]') as HTMLElement;
const anzeiger = (container: HTMLElement) =>
  container.querySelector('[class*="pullIndicator"]') as HTMLElement;

const hinweis = () => screen.queryByText(/Zum Aktualisieren nach unten ziehen/);
const loslassen = () => screen.queryByText(/Loslassen zum Aktualisieren/);
const sichtbar = (el: HTMLElement | null) => el !== null && getComputedStyle(el).opacity !== '0';

describe('Scroll mit onRefresh – der Hinweis zum Ziehen', () => {
  it('zeigt in Ruhe keinen Hinweis', () => {
    render(
      <Scroll onRefresh={() => Promise.resolve()}>
        <div>Inhalt</div>
      </Scroll>,
    );
    expect(sichtbar(hinweis())).toBe(false);
    expect(loslassen()).toBeNull();
  });

  it('blendet den Hinweis ein, sobald man deutlich zieht', () => {
    const { container } = render(
      <Scroll onRefresh={() => Promise.resolve()}>
        <div>Inhalt</div>
      </Scroll>,
    );
    const scroller = scrollBereich(container);
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
    const scroller = scrollBereich(container);
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
 *  1. Dauert der Abruf lange, steht die Anzeige so lange (das Warten auf das Versprechen).
 *  2. Kommt die Antwort aus dem Cache, blitzt die Anzeige nicht nur auf, sondern bleibt kurz stehen.
 *
 * **Was diese Tests NICHT bewachen** (Code-Check 23.09.2026): den Fehler der Abwesenheiten, deren
 * Neuladen gar kein Versprechen zurückgab. Hier wird `Scroll` direkt mit einem echten Versprechen
 * gerendert – das ging schon vorher. Diese Hälfte bewachen der Rückgabetyp von `onNeuLaden`
 * (Compiler) und `Availability.test.tsx` („Runterziehen zum Aktualisieren").
 *
 * Gemessen wird die Sichtbarkeit des Anzeigers (`opacity`) – unabhängig von den Klassennamen der
 * CSS-Module.
 */

describe('Scroll mit onRefresh – wie lange die Ladeanzeige steht', () => {
  afterEach(() => vi.useRealTimers());

  async function ziehenUndLoslassen(onRefresh: () => Promise<unknown>) {
    vi.useFakeTimers();
    const { container } = render(
      <Scroll onRefresh={onRefresh}>
        <div>Inhalt</div>
      </Scroll>,
    );
    const scroller = scrollBereich(container);
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
    expect(anzeiger(container).style.opacity).toBe('1');

    await act(async () => {
      fertig();
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(anzeiger(container).style.opacity).toBe('0');
  });

  it('blitzt bei einer sofortigen Antwort nicht nur auf', async () => {
    const container = await ziehenUndLoslassen(() => Promise.resolve());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(anzeiger(container).style.opacity).toBe('1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(anzeiger(container).style.opacity).toBe('0');
  });
});

/**
 * **Der Anzeiger steht fest, nur der Inhalt wandert** (Alwin, 22.09.2026, mit Screenshots: „bei
 * termine ist es falsch und bei lieder richtig").
 *
 * Vorher war die Höhe des Anzeigers die Zugstrecke – er saß damit am oberen Bildschirmrand, im
 * Unschärfe-Band von iOS, und wie weit er daraus herausrutschte, hing davon ab, ob die Liste lang
 * genug für das native Gummiband ist. Jetzt hat er eine feste Höhe und sitzt an fester Stelle;
 * verschoben wird nur der Inhalt.
 */
describe('Scroll mit onRefresh – wo der Anzeiger sitzt', () => {
  it('gibt dem Anzeiger eine feste Höhe, egal wie weit man zieht – nur der Inhalt wandert', () => {
    const { container } = render(
      <Scroll onRefresh={() => Promise.resolve()}>
        <div>Inhalt</div>
      </Scroll>,
    );
    const scroller = scrollBereich(container);

    ziehen(scroller, 40); // gedämpft 20 px
    expect(anzeiger(container).style.height).toBe('48px');

    ziehen(scroller, 160); // gedämpft 80 px
    expect(anzeiger(container).style.height).toBe('48px');
    expect((scroller.firstElementChild as HTMLElement).style.transform).toBe('translateY(80px)');
  });
});
