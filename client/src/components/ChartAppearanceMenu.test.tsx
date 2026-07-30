// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FONT_MIN, FONT_MAX } from '../utils/chartSettings';
import { ChartAppearanceMenu } from './ChartAppearanceMenu';

/**
 * #198: Das Aussehen-Menü, ausgelagert aus `pages/ChordChart.tsx`.
 *
 * Die Rechnung selbst steckt in `stepFontSize` (dort getestet). Hier zählt, dass die Knöpfe in die
 * RICHTIGE Richtung zeigen – ein vertauschtes A−/A+ wäre auf dem Notenständer sofort lästig – und
 * dass an den Grenzen der unveränderte Wert gemeldet wird, statt gar nichts zu tun.
 */
function setup(over: { fontSize?: number; cols?: 1 | 2 } = {}) {
  const handlers = { onFontSize: vi.fn(), onCols: vi.fn(), onClose: vi.fn() };
  render(
    <ChartAppearanceMenu fontSize={over.fontSize ?? 20} cols={over.cols ?? 1} {...handlers} />,
  );
  return handlers;
}

afterEach(cleanup);

describe('ChartAppearanceMenu', () => {
  it('A+ vergrößert, A− verkleinert (nicht vertauscht)', () => {
    const h = setup({ fontSize: 20 });
    screen.getByText('A+').click();
    expect(h.onFontSize).toHaveBeenCalledWith(22);
    screen.getByText('A−').click();
    expect(h.onFontSize).toHaveBeenLastCalledWith(18);
  });

  it('zeigt die aktuelle Größe an', () => {
    setup({ fontSize: 26 });
    expect(screen.getByText('26')).toBeTruthy();
  });

  it('an den Grenzen wird der unveränderte Wert gemeldet', () => {
    const h = setup({ fontSize: FONT_MAX });
    screen.getByText('A+').click();
    expect(h.onFontSize).toHaveBeenCalledWith(FONT_MAX);
    cleanup();
    const h2 = setup({ fontSize: FONT_MIN });
    screen.getByText('A−').click();
    expect(h2.onFontSize).toHaveBeenCalledWith(FONT_MIN);
  });

  it('die Spaltenwahl meldet 1 bzw. 2', () => {
    const h = setup({ cols: 1 });
    screen.getByText('2 Spalten').click();
    expect(h.onCols).toHaveBeenCalledWith(2);
    screen.getByText('1 Spalte').click();
    expect(h.onCols).toHaveBeenLastCalledWith(1);
  });
});
