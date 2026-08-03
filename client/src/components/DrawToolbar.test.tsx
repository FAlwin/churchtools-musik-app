// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DrawToolbar } from './DrawToolbar';
import { getDrawbarCollapsed } from '../utils/devicePrefs';

/**
 * #251: Die Werkzeugleiste (479 Zeilen) stand bei **0 %** Testabdeckung – und sie ist das, was
 * Musiker im Gottesdienst tatsächlich anfassen. Zeigergerät-Nahes (Ziehen, Stift, Handballen) bleibt
 * zu Recht manuell; hier festgehalten sind die **Bedienregeln**, die man beim Umbauen leicht kaputt
 * macht:
 *
 *  - Ein Tipp auf ein ANDERES Werkzeug wechselt. Ein zweiter Tipp auf das AKTIVE öffnet die
 *    Strichstärken (und schließt sie wieder) – ohne das Werkzeug zu wechseln.
 *  - Ein Werkzeugwechsel schließt die Strichstärken-Auswahl.
 *  - Wird ein Text auf der Seite ausgewählt, öffnet sich der Text-Balken von selbst.
 *  - Das Einklappen wird pro GERÄT gemerkt (nicht aufs Konto, siehe `devicePrefs`).
 */
const COLORS = ['#bb2946', '#0062ac'];

function setup(over: Partial<Parameters<typeof DrawToolbar>[0]> = {}) {
  const props = {
    colors: COLORS,
    drawColor: COLORS[0],
    setDrawColor: vi.fn(),
    drawTool: 'pen' as const,
    setDrawTool: vi.fn(),
    onClear: vi.fn(),
    toolSizes: { pen: 3, marker: 18, eraser: 26 },
    onToolSize: vi.fn(),
    ...over,
  };
  render(<DrawToolbar {...props} />);
  return props;
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('DrawToolbar – Werkzeugwahl', () => {
  it('ein Tipp auf ein anderes Werkzeug wechselt', () => {
    const p = setup({ drawTool: 'pen' });
    fireEvent.click(screen.getByLabelText('Marker'));
    expect(p.setDrawTool).toHaveBeenCalledWith('marker');
  });

  it('der zweite Tipp auf das AKTIVE Werkzeug öffnet die Strichstärken – ohne zu wechseln', () => {
    const p = setup({ drawTool: 'pen' });
    // Vorher ist keine Stärke-Auswahl offen.
    expect(screen.queryByLabelText(/^Stärke /)).toBeNull();

    fireEvent.click(screen.getByLabelText('Stift'));

    expect(p.setDrawTool).not.toHaveBeenCalled(); // kein Wechsel!
    expect(screen.getAllByLabelText(/^Stärke /).length).toBeGreaterThan(0);
  });

  it('ein dritter Tipp schließt die Strichstärken wieder', () => {
    setup({ drawTool: 'pen' });
    fireEvent.click(screen.getByLabelText('Stift'));
    expect(screen.getAllByLabelText(/^Stärke /).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Stift'));
    expect(screen.queryByLabelText(/^Stärke /)).toBeNull();
  });

  it('eine gewählte Strichstärke wird für das richtige Werkzeug gemeldet', () => {
    const p = setup({ drawTool: 'marker' });
    fireEvent.click(screen.getByLabelText('Marker')); // öffnet die Stärken des Markers
    const staerken = screen.getAllByLabelText(/^Stärke /);
    fireEvent.click(staerken[staerken.length - 1]); // die dickste
    expect(p.onToolSize).toHaveBeenCalledWith('marker', expect.any(Number));
  });

  it('eine Farbe zu wählen meldet sie zurück', () => {
    const p = setup();
    fireEvent.click(screen.getByLabelText('Farbe wählen')); // Palette aufklappen
    fireEvent.click(screen.getByLabelText(`Farbe ${COLORS[1]}`));
    expect(p.setDrawColor).toHaveBeenCalledWith(COLORS[1]);
  });
});

describe('DrawToolbar – Text', () => {
  it('ein ausgewählter Text öffnet den Text-Balken von selbst', () => {
    // Sonst müsste man nach dem Antippen eines Textes erst noch das Werkzeug antippen.
    setup({ drawTool: 'text', isTextSelected: true, textStyle: { bold: true } as never });
    expect(screen.getByLabelText('Kleiner')).toBeTruthy();
  });

  it('ohne Text-Werkzeug gibt es keinen Text-Knopf', () => {
    setup({ allowText: false });
    expect(screen.queryByLabelText('Text')).toBeNull();
  });
});

describe('DrawToolbar – pro Gerät gemerkt (#231)', () => {
  it('das Einklappen landet in den Geräte-Vorlieben, nicht im Konto-Namensraum', () => {
    setup();
    fireEvent.click(screen.getByLabelText('Werkzeugleiste einklappen'));

    expect(getDrawbarCollapsed()).toBe(true);
    // Konto-Sync greift nur `worship_*` auf – die Geräte-Vorlieben nutzen bewusst `worship:`.
    const kontoSchluessel = Object.keys(localStorage).filter((k) => k.startsWith('worship_'));
    expect(kontoSchluessel).toEqual([]);
  });

  it('eingeklappt gestartet zeigt den Ausklapp-Knopf', () => {
    localStorage.setItem('worship:drawbar-collapsed', '1');
    setup();
    expect(screen.getByLabelText('Werkzeugleiste ausklappen')).toBeTruthy();
  });
});
