// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SiteConfig } from '@shared/types/index';
import { Schalter } from './Schalter';
import { SchalterZeile } from './SchalterZeile';
import { LinksManager } from './LinksManager';
import styles from './Schalter.module.scss';

/**
 * Der eine Schalter (#413). Geprüft werden das Bedienmuster (der Knopf trägt `aria-pressed`, der
 * Schalter ist Anzeige) und dass die Stellen, die ihn nutzen, den Zustand richtig melden.
 */
vi.mock('../hooks/useSiteConfig', () => ({
  useUpdateSiteConfig: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('Schalter (#413)', () => {
  it('ist reine Anzeige und zeigt „an" nur, wenn er an ist', () => {
    const { container, rerender } = render(<Schalter an={false} />);
    const s = container.firstElementChild!;
    expect(s.getAttribute('aria-hidden')).toBe('true');
    expect(s.classList.contains(styles.an)).toBe(false);
    rerender(<Schalter an />);
    expect(container.firstElementChild!.classList.contains(styles.an)).toBe(true);
  });

  it('SchalterZeile: die Zeile ist EIN Knopf mit aria-pressed', () => {
    const umschalten = vi.fn<() => void>();
    render(<SchalterZeile label="Display aktiv halten" an onUmschalten={umschalten} />);
    const knopf = screen.getByRole('button', { name: 'Display aktiv halten' });
    expect(knopf.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(knopf);
    expect(umschalten).toHaveBeenCalledTimes(1);
  });

  it('Links-Verwaltung: „Auch auf Login-Seite zeigen" meldet seinen Zustand (fehlte bis 24.09.2026)', () => {
    const site = {
      appName: 'App',
      description: '',
      orgName: 'ECG',
      links: [{ id: 'a', label: 'Web', url: 'https://example.org', showOnLogin: false }],
    } as unknown as SiteConfig;
    render(<LinksManager site={site} onClose={() => undefined} />);
    const knopf = screen.getByRole('button', { name: 'Auch auf Login-Seite zeigen' });
    expect(knopf.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(knopf);
    expect(knopf.getAttribute('aria-pressed')).toBe('true');
  });
});
