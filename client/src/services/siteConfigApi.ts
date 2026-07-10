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

export interface CtGroup {
  id: number;
  name: string;
}

/** ChurchTools-Gruppen für das Admin-Dropdown „Musiker-Gruppe" (nur Admin). */
export function getGroups(): Promise<CtGroup[]> {
  return apiFetch<CtGroup[]>('/api/groups');
}

export interface CtRole {
  /** groupTypeRoleId – wird in `noteRoles.view/manage` gespeichert. */
  id: number;
  name: string;
}

/** Rollen einer Gruppe für die „Rollen-Zuweisung" (nur Admin). */
export function getGroupRoles(groupId: number): Promise<CtRole[]> {
  return apiFetch<CtRole[]>(`/api/groups/${groupId}/roles`);
}
