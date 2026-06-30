import { useQuery } from '@tanstack/react-query';
import { getUpdateInfo } from '../services/updateApi';

/** Aktuell laufende Version (Build-Zeit, ohne führendes „v"). */
const CURRENT = (import.meta.env.VITE_APP_VERSION || 'dev').replace(/^v/, '');

/**
 * Ist `latest` eine höhere Version als `current`? Vergleicht reine SemVer-Nummern (MAJOR.MINOR.PATCH).
 * Nicht-Versionen (z. B. „dev", „staging") liefern false → in solchen Builds erscheint kein Hinweis.
 */
function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map((n) => parseInt(n, 10));
  const b = current.split('.').map((n) => parseInt(n, 10));
  if (a.length < 3 || b.length < 3 || [...a, ...b].some((n) => Number.isNaN(n))) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export interface UpdateState {
  /** true, wenn eine neuere Version verfügbar ist als die laufende. */
  available: boolean;
  /** Neueste Versionsnummer (ohne „v"), falls bekannt. */
  latest: string | null;
  /** Link zur Release-Note. */
  url: string | null;
}

/**
 * Prüft (gecacht, einmal pro Sitzung / 6 h) auf eine neuere Version. Fehler werden still
 * verschluckt – ohne Antwort gibt es schlicht keinen Hinweis.
 */
export function useUpdateCheck(): UpdateState {
  const { data } = useQuery({
    queryKey: ['update-check'],
    queryFn: getUpdateInfo,
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 24,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const latest = data?.latest ?? null;
  return {
    available: !!latest && isNewer(latest, CURRENT),
    latest,
    url: data?.url ?? null,
  };
}
