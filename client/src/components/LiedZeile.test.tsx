// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiedZeile } from './LiedZeile';

/**
 * Die gemeinsame Liedzeile (#378): Zeile = Vorschau, Plus = einfügen. Geprüft wird, dass die beiden
 * Wege getrennt bleiben – ein Tipp auf die Zeile darf NICHT einfügen, und das Plus darf NICHT die
 * Vorschau öffnen. Genau diese Trennung ist der Grund, warum es zwei Knöpfe gibt.
 */
const onZeile = vi.fn();
const onPlus = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe('LiedZeile', () => {
  it('die Zeile öffnet die Vorschau, das Plus fügt ein – getrennt', () => {
    render(
      <LiedZeile
        titel="Treu"
        unterzeile="Autor T · Nr. 5841527"
        onZeile={onZeile}
        aktion={{ label: 'Zum Ablauf hinzufügen', onClick: onPlus }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Autor T/ }));
    expect(onZeile).toHaveBeenCalledTimes(1);
    expect(onPlus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /ohne Vorschau hinzufügen/ }));
    expect(onPlus).toHaveBeenCalledTimes(1);
    expect(onZeile).toHaveBeenCalledTimes(1);
  });

  it('ohne Aktion gibt es kein Plus – eine einfache Zeile fürs Liederheft', () => {
    render(<LiedZeile titel="Treu" unterzeile="… treue trägt …" onZeile={onZeile} />);
    expect(screen.queryByRole('button', { name: /ohne Vorschau/ })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('gesperrt sperrt beide Wege', () => {
    render(
      <LiedZeile
        titel="Treu"
        onZeile={onZeile}
        aktion={{ label: 'x', onClick: onPlus }}
        disabled
      />,
    );
    for (const b of screen.getAllByRole('button')) expect(b.hasAttribute('disabled')).toBe(true);
  });
});
