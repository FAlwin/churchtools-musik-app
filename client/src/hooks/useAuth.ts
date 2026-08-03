import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/churchtoolsApi';
import { resetSync as resetAnnotationsSync } from '../services/annotations';
import { resetSync as resetSettingsSync } from '../services/userSettings';
import { clearDeviceData } from '../utils/clearDeviceData';
import { ApiError } from '../services/api';

/** Anmeldestatus + Login/Logout. Nutzt das /api/auth/me-Cookie des Backends. */
export function useAuth() {
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    staleTime: 1000 * 60,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
    onSuccess: (status) => {
      qc.setQueryData(['me'], status);
      // Server-Sync wieder einschalten (#211): Nach einem automatischen Abmelden steht in beiden
      // Sync-Diensten `disabled = true`; ohne Reset speichern Anmerkungen und Lied-Einstellungen
      // für den Rest der Seiten-Lebensdauer NUR lokal und gehen geräteübergreifend verloren.
      resetAnnotationsSync();
      resetSettingsSync();
      // site-config wird schon auf dem Login-Screen geladen, dort aber nur mit den öffentlichen
      // Anzeige-Feldern (ohne Gruppen-/Rollen-IDs). Nach dem Login neu holen, damit die Admin-
      // Einstellungen die vollständige Konfiguration bekommen.
      void qc.invalidateQueries({ queryKey: ['site-config'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      // ALLE Konto-Daten aus Speicher + Gerät räumen (geteilte Gemeinde-Geräte!): erst den
      // In-Memory-Cache leeren, dann IndexedDB/Datei-Cache/localStorage (clearDeviceData).
      qc.removeQueries();
      qc.setQueryData(['me'], { authenticated: false });
      await clearDeviceData();
    },
  });

  return {
    isLoading: meQuery.isLoading,
    /**
     * Der Anmeldestatus ließ sich nicht ermitteln (#270): Der eigene Server antwortet, aber
     * ChurchTools nicht (Zeitüberschreitung, 5xx). Das ist ausdrücklich **nicht** „abgemeldet" – die
     * Anmeldung liegt weiter im Cookie und gilt nach dem Aussetzer wieder. Ohne diese Unterscheidung
     * erschien der Login-Screen, und dann gibt jemand mitten im Gottesdienst unnötig seine
     * ChurchTools-Zugangsdaten ein.
     *
     * Ein **401** ist bewusst ausgenommen: Dann ist die Sitzung wirklich tot und der Login gehört hin
     * (#186 – kein Screen darf ein 401 als „Erneut versuchen" anbieten).
     */
    statusUnknown: meQuery.error instanceof ApiError && meQuery.error.status !== 401,
    retryStatus: () => void meQuery.refetch(),
    isAuthenticated: meQuery.data?.authenticated ?? false,
    user: meQuery.data?.user,
    login: (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
  };
}
