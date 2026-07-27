// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { AgendaItem } from '@shared/types/index';
import { AgendaFullView } from './AgendaFullView';

/**
 * #198: Diese Ansicht lag in `Setlist.tsx` und war damit ungetestet – obwohl sie das ist, worauf
 * im Gottesdienst geschaut wird.
 *
 * Zwei Dinge sind hier heikel und deshalb festgehalten:
 *  - Die **Lied-Nummer** beim Antippen. Sie zählt nur LIEDER, nicht alle Ablaufpunkte. Stimmt sie
 *    nicht, landet man beim falschen Chart – mitten im Gottesdienst.
 *  - Die **Position aufgelöster Punkte**: Ein gelöschter Punkt muss dort zerfallen, wo er stand,
 *    nicht irgendwo. Sonst springt das Layout und man traut der Liste nicht mehr.
 */
function item(over: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: 1,
    title: 'Punkt',
    time: null,
    durationMin: null,
    note: '',
    isHeader: false,
    song: null,
    responsible: [],
    responsibleText: '',
    ...over,
  } as unknown as AgendaItem;
}

/** Ein Lied-Punkt (hat ein `song`). */
function songItem(id: number, title: string): AgendaItem {
  return item({ id, title, song: { title, songId: id, arrangementId: id } as never });
}

afterEach(cleanup);

describe('AgendaFullView – Zeilen', () => {
  it('zeigt Überschriften als eigenes Band', () => {
    render(
      <AgendaFullView
        items={[item({ id: 1, title: 'Lobpreis', isHeader: true })]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Lobpreis')).toBeTruthy();
  });

  it('zeigt Uhrzeit, Dauer, Notiz und Zuständige', () => {
    render(
      <AgendaFullView
        items={[
          item({
            id: 1,
            title: 'Begrüßung',
            time: '10:00',
            durationMin: 5,
            note: 'Kurz halten',
            responsible: [{ label: 'Anna', open: false }] as never,
          }),
        ]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('5 Min')).toBeTruthy();
    expect(screen.getByText('Kurz halten')).toBeTruthy();
    expect(screen.getByText('Anna')).toBeTruthy();
  });

  it('eine in ChurchTools ausgeblendete Uhrzeit bleibt leer', () => {
    const { container } = render(
      <AgendaFullView items={[item({ time: null })]} eventId={1} onSelect={vi.fn()} />,
    );
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}/);
  });
});

describe('AgendaFullView – Lied antippen', () => {
  it('zählt beim Antippen nur LIEDER, nicht alle Punkte', () => {
    const onSelect = vi.fn();
    render(
      <AgendaFullView
        items={[
          item({ id: 1, title: 'Begrüßung' }), // kein Lied
          songItem(2, 'Erstes Lied'),
          item({ id: 3, title: 'Predigt' }), // kein Lied
          songItem(4, 'Zweites Lied'),
        ]}
        eventId={1}
        onSelect={onSelect}
      />,
    );
    screen.getByText('Zweites Lied').closest('button')!.click();
    expect(onSelect).toHaveBeenCalledWith(1); // zweites LIED = Index 1
  });

  it('Punkte ohne Lied sind nicht antippbar', () => {
    const { container } = render(
      <AgendaFullView items={[item({ title: 'Predigt' })]} eventId={1} onSelect={vi.fn()} />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});

describe('AgendaFullView – entfernte Punkte auflösen', () => {
  it('zeigt einen vom Server gemeldeten entfernten Punkt an', () => {
    render(
      <AgendaFullView
        items={[{ id: 9, title: 'Weg damit', removed: true } as unknown as AgendaItem]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Entfernt: Weg damit')).toBeTruthy();
  });

  it('merkt selbst, wenn ein zuvor gezeigter Punkt verschwindet (#178)', () => {
    // Punkte, die erst nach dem Betreten hinzukamen und wieder gelöscht wurden, stehen NICHT in der
    // „gesehen"-Basislinie des Servers – er meldet für sie keinen Platzhalter. Die Ansicht muss das
    // selbst bemerken, sonst verschwindet die Zeile kommentarlos.
    const vorher = [item({ id: 1, title: 'Bleibt' }), item({ id: 2, title: 'Verschwindet' })];
    const { rerender } = render(<AgendaFullView items={vorher} eventId={1} onSelect={vi.fn()} />);
    rerender(
      <AgendaFullView items={[item({ id: 1, title: 'Bleibt' })]} eventId={1} onSelect={vi.fn()} />,
    );
    expect(screen.getByLabelText('Entfernt: Verschwindet')).toBeTruthy();
  });

  it('der Platzhalter steht an der Stelle des gelöschten Punkts, nicht am Ende', () => {
    const drei = [
      item({ id: 1, title: 'Eins' }),
      item({ id: 2, title: 'Zwei' }),
      item({ id: 3, title: 'Drei' }),
    ];
    const { rerender, container } = render(
      <AgendaFullView items={drei} eventId={1} onSelect={vi.fn()} />,
    );
    rerender(
      <AgendaFullView
        items={[item({ id: 1, title: 'Eins' }), item({ id: 3, title: 'Drei' })]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    const text = container.textContent ?? '';
    expect(text.indexOf('Eins')).toBeLessThan(text.indexOf('Zwei'));
    expect(text.indexOf('Zwei')).toBeLessThan(text.indexOf('Drei'));
  });

  it('ein Terminwechsel löst NICHTS auf (die Punkte gehören zu einem anderen Termin)', () => {
    const { rerender } = render(
      <AgendaFullView
        items={[item({ id: 1, title: 'Termin A' })]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    rerender(
      <AgendaFullView
        items={[item({ id: 5, title: 'Termin B' })]}
        eventId={2}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Entfernt: Termin A')).toBeNull();
  });

  it('ein rückgängig gemachter Punkt taucht wieder als echte Zeile auf', () => {
    const zwei = [item({ id: 1, title: 'Eins' }), item({ id: 2, title: 'Zwei' })];
    const { rerender } = render(<AgendaFullView items={zwei} eventId={1} onSelect={vi.fn()} />);
    rerender(
      <AgendaFullView items={[item({ id: 1, title: 'Eins' })]} eventId={1} onSelect={vi.fn()} />,
    );
    expect(screen.getByLabelText('Entfernt: Zwei')).toBeTruthy();

    // Wieder da (z. B. in ChurchTools rückgängig gemacht) → kein Platzhalter mehr.
    rerender(<AgendaFullView items={[...zwei]} eventId={1} onSelect={vi.fn()} />);
    expect(screen.queryByLabelText('Entfernt: Zwei')).toBeNull();
  });
});
