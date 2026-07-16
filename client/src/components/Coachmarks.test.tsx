// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Coachmarks, type CoachStep } from './Coachmarks';

// jsdom implementiert scrollIntoView/scrollTo nicht → als No-op stubben.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
beforeEach(() => {
  document.body.innerHTML = '';
});

const twoSteps: CoachStep[] = [
  { selector: '[data-tour="a"]', title: 'Erster Schritt', body: 'Erklärung A' },
  { selector: '[data-tour="b"]', title: 'Zweiter Schritt', body: 'Erklärung B' },
];

describe('Coachmarks', () => {
  it('durchläuft alle Schritte und ruft onClose bei „Fertig"', () => {
    document.body.innerHTML = '<button data-tour="a">A</button><button data-tour="b">B</button>';
    const onClose = vi.fn();
    render(<Coachmarks steps={twoSteps} onClose={onClose} />);

    expect(screen.getByText('Erster Schritt')).toBeTruthy();
    expect(screen.getByText('Schritt 1 von 2')).toBeTruthy();

    fireEvent.click(screen.getByText('Weiter'));
    expect(screen.getByText('Zweiter Schritt')).toBeTruthy();
    expect(screen.getByText('Schritt 2 von 2')).toBeTruthy();

    fireEvent.click(screen.getByText('Fertig'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('beendet die Tour über „Überspringen"', () => {
    document.body.innerHTML = '<button data-tour="a">A</button><button data-tour="b">B</button>';
    const onClose = vi.fn();
    render(<Coachmarks steps={twoSteps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Überspringen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('beendet automatisch, wenn kein Ziel-Element existiert', () => {
    const onClose = vi.fn();
    render(
      <Coachmarks
        steps={[{ selector: '[data-tour="fehlt"]', title: 'X', body: 'Y' }]}
        onClose={onClose}
      />,
    );
    expect(onClose).toHaveBeenCalled();
    // Ohne sichtbares Ziel wird nichts gerendert.
    expect(screen.queryByText('X')).toBeNull();
  });

  it('überspringt einen fehlenden Schritt und zeigt den nächsten vorhandenen', () => {
    document.body.innerHTML = '<button data-tour="b">B</button>';
    const onClose = vi.fn();
    render(<Coachmarks steps={twoSteps} onClose={onClose} />);
    // Schritt 1 (a) fehlt → springt auf Schritt 2 (b).
    expect(screen.getByText('Zweiter Schritt')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
