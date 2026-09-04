// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SucheAngebot } from './SucheAngebot';

/**
 * Der Angebots-Knopf (#378) – klein, aber an drei Stellen: Liedtexte im Liederheft, Liedtexte und
 * SongSelect im Einfüge-Dialog. Geprüft wird nur, dass er den Text zeigt und den Tipp meldet; die
 * Regeln, WANN er erscheint, liegen in `useLiedSuche` und werden dort geprüft.
 */
describe('SucheAngebot', () => {
  it('zeigt den Text und meldet den Tipp', () => {
    const onClick = vi.fn();
    render(<SucheAngebot text={'Bei SongSelect nach „Gnade" suchen'} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Bei SongSelect nach „Gnade" suchen/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
