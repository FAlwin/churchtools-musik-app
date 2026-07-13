import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/churchtoolsApi';
import { clearDeviceData } from '../utils/clearDeviceData';

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
    isAuthenticated: meQuery.data?.authenticated ?? false,
    user: meQuery.data?.user,
    login: (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
  };
}
