// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonatsLeiste } from './MonatsLeiste';

/**
 * Die Monatsleiste (#177, 19.09.2026): nur nach vorn, „Heute" führt zurück, das Raster klappt oben auf.
 */
function zeige(monat = '2026-10', markiert = new Set<string>(['2026-11'])) {
  const onMonat = vi.fn();
  render(<MonatsLeiste heute="2026-10-05" monat={monat} onMonat={onMonat} markiert={markiert} />);
  return { onMonat };
}

describe('MonatsLeiste', () => {
  it('zeigt den laufenden Monat und sechs voraus – nichts Vergangenes', () => {
    zeige();
    const pills = screen
      .getAllByRole('button', { pressed: true })
      .concat(screen.getAllByRole('button', { pressed: false }));
    const texte = pills.map((b) => b.textContent);
    expect(texte).toContain('Okt 26');
    expect(texte).toContain('Apr 27');
    expect(texte).not.toContain('Sep 26');
    expect(texte).not.toContain('Mai 27');
  });

  it('„Heute" ist im laufenden Monat ausgegraut und springt sonst zurück', () => {
    const { onMonat } = zeige('2027-02');
    const heute = screen.getByRole('button', { name: 'Heute' });
    expect((heute as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(heute);
    expect(onMonat).toHaveBeenCalledWith('2026-10');
  });

  it('im laufenden Monat ist „Heute" gesperrt', () => {
    zeige('2026-10');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Heute' }).disabled).toBe(true);
  });

  it('der Pfeil klappt zwölf Monate ab heute auf, mit Punkt bei Einträgen; eine Wahl klappt wieder zu', () => {
    const { onMonat } = zeige();
    expect(screen.queryByRole('group', { name: 'Monat wählen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Monate' }));
    const raster = screen.getByRole('group', { name: 'Monat wählen' });
    const zellen = raster.querySelectorAll('button');
    expect(zellen.length).toBe(12);
    expect(zellen[0].textContent).toBe('Okt');
    expect(zellen[3].textContent).toBe('Jan 27'); // Jahreswechsel bekommt das Jahr dazu
    expect(zellen[1].querySelector('span')).not.toBeNull(); // November hat einen Eintrag
    expect(zellen[0].querySelector('span')).toBeNull();
    fireEvent.click(zellen[5]);
    expect(onMonat).toHaveBeenCalledWith('2027-03');
    expect(screen.queryByRole('group', { name: 'Monat wählen' })).toBeNull();
  });

  it('ein aus dem Raster gewählter Monat jenseits der sechs steht als Pill dabei', () => {
    zeige('2027-08');
    expect(screen.getByRole('button', { name: 'Aug 27' })).not.toBeNull();
  });
});
