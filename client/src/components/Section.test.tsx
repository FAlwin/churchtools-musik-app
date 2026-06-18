// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ChordProSection } from '@shared/types/index';
import { Section } from './Section';

afterEach(cleanup);

describe('Section', () => {
  const section: ChordProSection = {
    type: 'verse',
    label: 'Vers 1',
    lines: ['[C]Hallo [G]Welt'],
  };

  it('zeigt Label, Akkorde und Text', () => {
    const { container } = render(<Section section={section} semitones={0} fontSize={20} />);
    expect(screen.getByText('Vers 1')).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text).toContain('Hallo');
    expect(text).toContain('Welt');
    expect(text).toContain('C');
    expect(text).toContain('G');
  });

  it('transponiert die Akkorde (+2 Halbtöne: C→D, G→A)', () => {
    const { container } = render(<Section section={section} semitones={2} fontSize={20} />);
    const text = container.textContent ?? '';
    expect(text).toContain('D');
    expect(text).toContain('A');
    expect(text).not.toContain('[C]'); // Rohmarkup darf nicht auftauchen
  });
});
