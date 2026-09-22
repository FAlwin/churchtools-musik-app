// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeitenGeruest } from './SeitenGeruest';

/**
 * **Das gemeinsame Gerüst aller Bildschirme** (22.09.2026, Wunsch Alwin: „bitte alles gleich mit
 * dem Header und den sachen").
 *
 * Geprüft wird das, was vorher jede Seite selbst zusammengesetzt hat und worin sie auseinanderliefen:
 * die Überschrift im Inhalt, die Leiste nur dort, wo es etwas anzutippen gibt, und – am wichtigsten –
 * dass die Überlagerung NEBEN dem Scroll-Bereich liegt. Läge sie darin, scrollten der Plus-Knopf der
 * Abwesenheiten und die Speichern-Leiste mit weg.
 */
function scrollBereich(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[class*="scroll"]');
  if (!el) throw new Error('Scroll-Bereich nicht gefunden');
  return el as HTMLElement;
}

describe('SeitenGeruest', () => {
  it('setzt den Titel als Überschrift in den Inhalt', () => {
    const { container } = render(<SeitenGeruest titel="Termine">Liste</SeitenGeruest>);
    const titel = screen.getByRole('heading', { name: 'Termine' });
    expect(scrollBereich(container).contains(titel)).toBe(true);
  });

  it('zeigt ohne Zurück und ohne Aktionen gar keine Leiste', () => {
    render(<SeitenGeruest titel="Mehr">Inhalt</SeitenGeruest>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('zeigt die Leiste mit Zurück und Aktionen', () => {
    const zurueck = vi.fn();
    render(
      <SeitenGeruest
        titel="Ablauf"
        unterzeile="Sonntag, 5. Oktober · 10:00"
        zurueck={zurueck}
        zurueckLabel="Termine"
        aktionen={<button>Teilen</button>}
      >
        Inhalt
      </SeitenGeruest>,
    );
    expect(screen.getByRole('button', { name: /Termine/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Teilen' })).toBeTruthy();
    expect(screen.getByText('Sonntag, 5. Oktober · 10:00')).toBeTruthy();
  });

  it('hängt die Überlagerung neben den Scroll-Bereich, nicht hinein', () => {
    const { container } = render(
      <SeitenGeruest titel="Abwesenheiten" ueberlagerung={<button>Zeitraum eintragen</button>}>
        Inhalt
      </SeitenGeruest>,
    );
    const plus = screen.getByRole('button', { name: 'Zeitraum eintragen' });
    expect(scrollBereich(container).contains(plus)).toBe(false);
  });

  it('gibt das Neuladen an den Scroll-Bereich weiter', () => {
    const { container } = render(
      <SeitenGeruest titel="Lieder" onNeuLaden={() => Promise.resolve()}>
        Inhalt
      </SeitenGeruest>,
    );
    // Der Zug-Anzeiger hängt NEBEN dem Scroll-Bereich (feste Stelle, unter dem Unschärfe-Band von
    // iOS) – ohne onNeuLaden gäbe es ihn gar nicht.
    const zug = container.querySelector('[class*="pullIndicator"]');
    expect(zug).not.toBeNull();
    expect(scrollBereich(container).contains(zug)).toBe(false);
  });
});
