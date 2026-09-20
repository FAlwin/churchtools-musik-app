// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@shared/types/index';

/**
 * Der Admin-Editor der Termin-Arten (#400) – gegen die echte Komponente, nur die Speicher-Mutation als
 * Attrappe. Geprüft wird, WAS gespeichert wird: getrimmt, ohne leere Zeilen, und dass eine halbe
 * Zeile (Name ohne Suchwort) nicht still verschwindet, sondern gemeldet wird.
 */
const mutate = vi.fn();
vi.mock('../hooks/useSiteConfig', () => ({
  useUpdateSiteConfig: () => ({ mutate, isPending: false }),
}));

const { TerminArtenManager } = await import('./TerminArtenManager');

const SITE: SiteConfig = {
  ...DEFAULT_SITE_CONFIG,
  terminArten: [{ id: 'gd', name: 'Gottesdienst', suchwort: 'Gottesdienst' }],
};

beforeEach(() => vi.clearAllMocks());

function zeige(site: SiteConfig = SITE) {
  const onClose = vi.fn();
  render(<TerminArtenManager site={site} onClose={onClose} />);
  return { onClose };
}

describe('TerminArtenManager', () => {
  it('zeigt die vorhandenen Arten', () => {
    zeige();
    // Name UND Suchwort tragen hier denselben Wert – beide Felder müssen ihn zeigen.
    expect(screen.getAllByDisplayValue('Gottesdienst')).toHaveLength(2);
  });

  it('fügt eine Zeile hinzu und speichert getrimmt', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Termin-Art hinzufügen/ }));
    const namen = screen.getAllByLabelText('Name');
    const worte = screen.getAllByLabelText('Suchwort');
    fireEvent.change(namen[1], { target: { value: '  Gebetsabend ' } });
    fireEvent.change(worte[1], { target: { value: ' gebet ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(mutate).toHaveBeenCalledTimes(1);
    const gespeichert = (mutate.mock.calls[0][0] as SiteConfig).terminArten ?? [];
    expect(gespeichert.map((a) => [a.name, a.suchwort])).toEqual([
      ['Gottesdienst', 'Gottesdienst'],
      ['Gebetsabend', 'gebet'],
    ]);
  });

  it('meldet eine halbe Zeile, statt sie still zu verwerfen', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Termin-Art hinzufügen/ }));
    fireEvent.change(screen.getAllByLabelText('Name')[1], { target: { value: 'Probe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Namen und ein Suchwort/)).not.toBeNull();
  });

  it('eine ganz leere Zeile fällt beim Speichern weg', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Termin-Art hinzufügen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const gespeichert = (mutate.mock.calls[0][0] as SiteConfig).terminArten ?? [];
    expect(gespeichert).toHaveLength(1);
  });

  it('löscht eine Art', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Termin-Art löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect((mutate.mock.calls[0][0] as SiteConfig).terminArten).toEqual([]);
  });
});
