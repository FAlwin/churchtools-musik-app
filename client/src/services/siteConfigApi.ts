/** API-Aufrufe für das Laufzeit-Branding (White-Label). */
import type { SiteConfig } from '@shared/types/index';
import { apiFetch } from './api';

export function getSiteConfig(): Promise<SiteConfig> {
  return apiFetch<SiteConfig>('/api/site-config');
}

export function updateSiteConfig(cfg: SiteConfig): Promise<SiteConfig> {
  return apiFetch<SiteConfig>('/api/site-config', {
    method: 'PUT',
    body: JSON.stringify(cfg),
  });
}
