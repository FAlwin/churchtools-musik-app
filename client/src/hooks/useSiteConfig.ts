import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@shared/types/index';
import * as api from '../services/siteConfigApi';
import { applyBranding } from '../utils/applyBranding';

/**
 * Lädt das Laufzeit-Branding und wendet es bei jeder Änderung auf das Dokument an.
 * Bis die echten Werte da sind, gelten die Defaults (kein Aufblitzen ungebrandet).
 */
export function useSiteConfig() {
  const query = useQuery({
    queryKey: ['site-config'],
    queryFn: api.getSiteConfig,
    initialData: DEFAULT_SITE_CONFIG,
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (query.data) applyBranding(query.data);
  }, [query.data]);

  return query;
}

/** Speichert das Branding (nur Admin) und aktualisiert sofort die Anzeige. */
export function useUpdateSiteConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cfg: SiteConfig) => api.updateSiteConfig(cfg),
    onSuccess: (saved) => {
      qc.setQueryData(['site-config'], saved);
      applyBranding(saved);
    },
  });
}
