/**
 * Wendet das Branding auf das Dokument an. Farben sind jetzt fest in den
 * CSS-Tokens (`styles/_variables.scss`) – es wird NICHTS mehr zur Laufzeit
 * eingefärbt (feste ChurchTools-Version). Nur der Seitentitel folgt dem Namen.
 */
import type { SiteConfig } from '@shared/types/index';

export function applyBranding(cfg: SiteConfig): void {
  document.title = `${cfg.appName} · ${cfg.orgName}`;
}
