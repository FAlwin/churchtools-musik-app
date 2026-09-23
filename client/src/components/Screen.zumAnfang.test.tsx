// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Scroll, scrolleZumAnfang } from './Screen';
import { TabBar } from './TabBar';

/**
 * **„Nach oben" über den aktiven Tab** (22.09.2026).
 *
 * Alwin wollte, dass ein Tipp auf die Uhrzeit die Liste nach oben scrollt. Das kann eine Web-App
 * nicht: iOS reicht diesen Tipp nur an den Haupt-Scroller des Dokuments weiter, und die App scrollt
 * in einem inneren Bereich. Der Ersatz ist der zweite Weg nativer Apps – ein Tipp auf den bereits
 * aktiven Tab. Diese Tests halten beide Hälften fest: dass die Leiste ruft und dass der
 * Scroll-Bereich hört.
 *
 * `scrollTo` gibt es in jsdom nicht; genau dafür hat die Umsetzung die Absicherung über `scrollTop`,
 * die hier mitgeprüft wird (mit Fake-Timern, sonst liefe der Test in die echte Wartezeit).
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function Bereich() {
  return (
    <Scroll>
      <div>Inhalt</div>
    </Scroll>
  );
}

describe('Scroll – hört auf „zum Anfang"', () => {
  it('setzt den Scroll-Bereich zurück', () => {
    const { container } = render(<Bereich />);
    const bereich = container.firstElementChild as HTMLElement;
    bereich.scrollTop = 400;

    scrolleZumAnfang();
    vi.advanceTimersByTime(500);

    expect(bereich.scrollTop).toBe(0);
  });

  it('rührt einen Bereich nicht an, der schon oben steht', () => {
    const { container } = render(<Bereich />);
    const bereich = container.firstElementChild as HTMLElement;
    const setzer = vi.spyOn(bereich, 'scrollTop', 'set');

    scrolleZumAnfang();
    vi.advanceTimersByTime(500);

    expect(setzer).not.toHaveBeenCalled();
  });

  it('hört nicht mehr, wenn die Seite weg ist', () => {
    const { container, unmount } = render(<Bereich />);
    const bereich = container.firstElementChild as HTMLElement;
    bereich.scrollTop = 400;
    unmount();

    scrolleZumAnfang();
    vi.advanceTimersByTime(500);

    expect(bereich.scrollTop).toBe(400);
  });
});

describe('TabBar – der aktive Tab scrollt nach oben', () => {
  it('wechselt NICHT, sondern scrollt, wenn der aktive Tab getippt wird', () => {
    const onChange = vi.fn();
    const { container } = render(
      <>
        <Scroll>
          <div>Inhalt</div>
        </Scroll>
        <TabBar active="termine" tabs={['termine', 'lieder']} onChange={onChange} />
      </>,
    );
    const bereich = container.firstElementChild as HTMLElement;
    bereich.scrollTop = 400;

    fireEvent.click(screen.getByText('Termine'));
    vi.advanceTimersByTime(500);

    expect(onChange).not.toHaveBeenCalled();
    expect(bereich.scrollTop).toBe(0);
  });

  it('wechselt wie bisher, wenn ein anderer Tab getippt wird', () => {
    const onChange = vi.fn();
    render(<TabBar active="termine" tabs={['termine', 'lieder']} onChange={onChange} />);

    fireEvent.click(screen.getByText('Lieder'));

    expect(onChange).toHaveBeenCalledWith('lieder');
  });
});
