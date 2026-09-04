// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiedSucheKopf } from './LiedSucheKopf';

/**
 * Das eine Suchfeld (#378, seit 03.09.2026 ohne Umschalter).
 *
 * Geprüft wird, was der Nutzer anfassen kann: Der Platzhalter, und was die Eingabetaste tut – nämlich
 * NUR dort etwas, wo es SongSelect gibt. Die Regeln, wann eine Quelle gefragt wird, liegen in
 * `useLiedSuche` und werden dort geprüft.
 */
const onEingabe = vi.fn();
const onSongSelectSuchen = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe('LiedSucheKopf', () => {
  it('ein Platzhalter für alle Stellen – Lied oder Autor', () => {
    render(<LiedSucheKopf eingabe="" onEingabe={onEingabe} />);
    expect(screen.getByPlaceholderText('Lied oder Autor suchen…')).toBeTruthy();
  });

  it('meldet jede Eingabe', () => {
    render(<LiedSucheKopf eingabe="" onEingabe={onEingabe} />);
    fireEvent.change(screen.getByPlaceholderText(/Lied oder Autor/), { target: { value: 'Gna' } });
    expect(onEingabe).toHaveBeenCalledWith('Gna');
  });

  it('die Eingabetaste schickt an SongSelect, wenn es den Weg gibt', () => {
    render(
      <LiedSucheKopf
        eingabe="Treu"
        onEingabe={onEingabe}
        onSongSelectSuchen={onSongSelectSuchen}
      />,
    );
    fireEvent.keyDown(screen.getByPlaceholderText(/Lied oder Autor/), { key: 'Enter' });
    expect(onSongSelectSuchen).toHaveBeenCalledTimes(1);
  });

  it('ohne den Weg tut die Eingabetaste NICHTS', () => {
    // Liederheft und „Lied verknüpfen": Die Bibliothek ist beim Tippen längst gefiltert, es gibt nichts
    // abzuschicken.
    render(<LiedSucheKopf eingabe="Treu" onEingabe={onEingabe} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/Lied oder Autor/), { key: 'Enter' });
    expect(onSongSelectSuchen).not.toHaveBeenCalled();
  });

  it('es gibt keinen Umschalter und keinen Such-Knopf mehr', () => {
    // Gegenprobe zur Entscheidung vom 03.09.2026: ein Feld, sonst nichts.
    render(
      <LiedSucheKopf
        eingabe="Treu"
        onEingabe={onEingabe}
        onSongSelectSuchen={onSongSelectSuchen}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
