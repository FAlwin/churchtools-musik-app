// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { AgendaItem } from '@shared/types/index';
import { ItemTitle, ResponsibleLine } from './AgendaRowParts';

/**
 * #198: Die Bausteine einer Ablaufzeile, ausgelagert aus `Setlist.tsx`. Beide werden an ZWEI
 * Stellen verwendet (Ablauf-Ansicht und sortierbare Zeile im Bearbeiten-Modus) – deshalb hier
 * einmal festgehalten, was sie zeigen.
 *
 * Bei den Zuständigen zählt vor allem die Unterscheidung: ein besetzter Platz ist ein Name, ein
 * OFFENER Dienst muss als solcher erkennbar sein („Musik ?"). Wer das verwechselt, denkt vor dem
 * Gottesdienst, alles sei besetzt.
 */
function item(over: Partial<AgendaItem> = {}): AgendaItem {
  return { id: 1, title: 'Punkt', song: null, ...over } as unknown as AgendaItem;
}

afterEach(cleanup);

describe('ItemTitle', () => {
  it('zeigt bei einem Punkt ohne Lied nur den Titel', () => {
    render(<ItemTitle item={item({ title: 'Begrüßung' })} />);
    expect(screen.getByText('Begrüßung')).toBeTruthy();
  });

  it('zeigt Titel UND Liedname, wenn der Liedname etwas hinzufügt (#200)', () => {
    render(
      <ItemTitle
        item={item({ title: 'Lied', song: { title: 'Du großer Gott' } as never })}
      />,
    );
    expect(screen.getByText('Lied')).toBeTruthy();
    expect(screen.getByText(/Du großer Gott/)).toBeTruthy();
  });

  it('lässt den Liedname weg, wenn er dem Titel entspricht (keine Dopplung)', () => {
    const { container } = render(
      <ItemTitle
        item={item({ title: 'Du großer Gott', song: { title: 'Du großer Gott' } as never })}
      />,
    );
    expect(container.textContent).toBe('Du großer Gott');
  });
});

describe('ResponsibleLine', () => {
  it('zeigt nichts, wenn niemand zuständig ist (keine leere Zeile)', () => {
    const { container } = render(<ResponsibleLine entries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('besetzte Plätze erscheinen als Name', () => {
    render(<ResponsibleLine entries={[{ label: 'Anna', open: false }] as never} />);
    expect(screen.getByText('Anna')).toBeTruthy();
  });

  it('OFFENE Dienste sind mit „?" gekennzeichnet', () => {
    render(<ResponsibleLine entries={[{ label: 'Musik', open: true }] as never} />);
    expect(screen.getByText(/Musik \?/)).toBeTruthy();
  });

  it('trennt mehrere mit Komma – das Komma bleibt am Namen (Umbruch)', () => {
    const { container } = render(
      <ResponsibleLine
        entries={
          [
            { label: 'Anna', open: false },
            { label: 'Ben', open: false },
          ] as never
        }
      />,
    );
    expect(container.textContent).toContain('Anna,');
    expect(container.textContent).toContain('Ben');
    // Beim letzten Eintrag steht kein Komma.
    expect(container.textContent).not.toContain('Ben,');
  });
});

/**
 * Die ausgelagerten Komponenten importieren `Setlist.module.scss` jetzt aus einem ANDEREN
 * Verzeichnis. Wäre der Pfad falsch, gäbe es keinen Fehler – CSS-Module liefern dann still
 * `undefined`, und die Zeilen stünden ohne jedes Layout da. Deshalb hier ausdrücklich geprüft.
 */
describe('CSS-Modul erreichbar', () => {
  it('die Zeilen bekommen echte Klassennamen, nicht „undefined"', () => {
    const { container } = render(<ItemTitle item={item({ title: 'Begrüßung' })} />);
    const cls = (container.firstElementChild as HTMLElement).className;
    expect(cls).toBeTruthy();
    expect(cls).not.toContain('undefined');
  });
});
