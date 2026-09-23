import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthStatus } from '@shared/types/index';
import * as api from '../services/churchtoolsApi';
import { resetSync as resetAnnotationsSync } from '../services/annotations';
import { resetSync as resetSettingsSync } from '../services/userSettings';
import { clearDeviceData } from '../utils/clearDeviceData';
import { ApiError } from '../services/api';
import { getAbmeldenAusstehend, setAbmeldenAusstehend } from '../utils/devicePrefs';

/** Anmeldestatus + Login/Logout. Nutzt das /api/auth/me-Cookie des Backends. */
export function useAuth() {
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['me'],
    /**
     * Steht ein Abmelden noch aus (#403), wird es ZUERST nachgeholt – und bis der Server es bestätigt
     * hat, gilt das Gerät als abgemeldet. Sonst zeigte `/api/auth/me` mit dem liegengebliebenen
     * Cookie der nächsten Person das Konto der vorigen.
     */
    queryFn: async (): Promise<AuthStatus> => {
      if (getAbmeldenAusstehend()) {
        try {
          await api.logout();
          setAbmeldenAusstehend(false);
        } catch {
          /* weiterhin nicht erreichbar – der Merker bleibt, das Gerät bleibt abgemeldet */
        }
        return { authenticated: false };
      }
      return api.getMe();
    },
    staleTime: 1000 * 60,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
    onSuccess: (status) => {
      // Eine neue Anmeldung ersetzt das alte Cookie – ein noch ausstehendes Abmelden ist damit erledigt.
      setAbmeldenAusstehend(false);
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
    /**
     * **Das Gerät wird IMMER geräumt – auch wenn der Server nicht antwortet** (#403).
     *
     * Bis zum 23.09.2026 lief das Aufräumen nur im `onSuccess`: Ohne Netz blieben Abläufe samt
     * Personennamen, der Datei-Cache und die Anmerkungen liegen – ausgerechnet auf den geteilten
     * Gemeindegeräten, für die das Aufräumen gedacht ist. Der Server-Aufruf ist jetzt bestes Bemühen;
     * scheitert er, merkt sich das Gerät das Abmelden und holt es beim nächsten Start nach (siehe
     * `meQuery`). Die Funktion wirft deshalb auch nicht: Für den Nutzer IST er abgemeldet.
     */
    mutationFn: async () => {
      let serverBestaetigt = true;
      try {
        await api.logout();
      } catch {
        serverBestaetigt = false;
      }
      // Den Merker ZUERST setzen: `removeQueries` stößt sofort eine neue Statusabfrage an, und die
      // muss schon am Merker vorbeikommen – sonst fragte sie mit dem liegengebliebenen Cookie den
      // alten Status ab (vom Test gefunden, 23.09.2026). Das Aufräumen lässt den Merker stehen, er
      // liegt im `worship:`-Namensraum.
      setAbmeldenAusstehend(!serverBestaetigt);
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
