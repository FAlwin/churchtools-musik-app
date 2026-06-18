/**
 * Wendet das Laufzeit-Branding auf das Dokument an: CSS-Variablen (Farben),
 * Seitentitel und theme-color. So lässt sich das Erscheinungsbild ändern,
 * ohne die App neu zu bauen.
 */
import type { SiteConfig } from '@shared/types/index';
import { lighten, rgba } from './color';

export function applyBranding(cfg: SiteConfig): void {
  const root = document.documentElement;

  // Hauptfarbe (Teal-Ersatz) und ihre abgeleiteten Werte.
  root.style.setProperty('--teal', cfg.primaryColor);
  root.style.setProperty('--surface', cfg.primaryColor);
  root.style.setProperty('--teal-light', lighten(cfg.primaryColor, 0.35));
  root.style.setProperty('--border', rgba(cfg.primaryColor, 0.13));

  // Akkordfarbe (Orange-Ersatz).
  root.style.setProperty('--orange', cfg.accentColor);
  root.style.setProperty('--chord', cfg.accentColor);
  root.style.setProperty('--chord-dim', rgba(cfg.accentColor, 0.1));

  // Titel + theme-color.
  document.title = `${cfg.appName} · ${cfg.orgName}`;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', cfg.primaryColor);
}
