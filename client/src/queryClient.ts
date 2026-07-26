import { QueryClient, QueryCache, MutationCache, dehydrate } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { ApiError } from './services/api';

const WEEK = 1000 * 60 * 60 * 24 * 7;

/**
 * Globaler „Session abgelaufen"-Melder (#186): Ein 401 aus IRGENDEINER Query oder Mutation heißt,
 * die ChurchTools-Session ist tot (unser App-Cookie ist evtl. noch da). Früher fing das nur die
 * Rechte-Abfrage in App.tsx ab – an ihr vorbei (Ablauf laden, Ablaufpunkt speichern) lief man in
 * eine „Erneut versuchen"-Sackgasse, aus der nur Ab- und Neuanmelden half. Der Melder führt jetzt
 * in ALLEN Fällen sauber zum Login. App.tsx registriert den Handler (→ auth.logout()).
 */
let sessionExpiredHandler: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null): void {
  sessionExpiredHandler = fn;
}
function handleGlobalError(error: unknown): void {
  if (error instanceof ApiError && error.status === 401) sessionExpiredHandler?.();
}
const CACHE_KEY = 'worship-rq-cache';
// buster = App-Version → ein App-Update verwirft den alten Cache (verhindert veraltete Datenformen).
const BUSTER = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev';

/**
 * QueryClient mit langer Aufbewahrung: `gcTime` = 7 Tage, damit einmal geladene Daten (Termine,
 * Ablauf/ChordPro, Anmeldestatus) im Speicher bleiben und persistiert werden können – Grundlage
 * der Offline-Reserve (Charts ohne Netz im Saal, Issue #32).
 */
export const queryClient = new QueryClient({
  // Global über QueryCache + MutationCache, damit ein 401 aus jeder Quelle erkannt wird (#186).
  queryCache: new QueryCache({ onError: handleGlobalError }),
  mutationCache: new MutationCache({ onError: handleGlobalError }),
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, gcTime: WEEK, retry: 1 },
  },
});

// Cache in IndexedDB spiegeln (überlebt App-Neustart). IndexedDB statt localStorage wegen der
// größeren Kapazität (ChordPro/viele Lieder). idb-keyval liefert die getItem/setItem/removeItem-Hülle.
export function createIdbPersister(throttleTime = 1000) {
  return createAsyncStoragePersister({
    key: CACHE_KEY,
    storage: {
      getItem: async (k) => (await get<string>(k)) ?? null,
      setItem: (k, v) => set(k, v),
      removeItem: (k) => del(k),
    },
    throttleTime,
  });
}

const persister = createIdbPersister();

/**
 * Persist-Optionen für den PersistQueryClientProvider. Persistiert werden alle erfolgreichen
 * Queries (inkl. `['me']` → man bleibt offline angemeldet, solange die Session gültig war).
 */
export const persistOptions = { persister, maxAge: WEEK, buster: BUSTER };

/**
 * Den aktuellen Cache SOFORT nach IndexedDB schreiben (ohne den 1s-Throttle des Providers) –
 * für den „Für offline speichern"-Knopf, damit der Gottesdienst deterministisch verfügbar ist,
 * bevor der Nutzer das Netz verlässt. Format identisch zum Provider (PersistedClient).
 */
export async function saveOfflineNow(): Promise<void> {
  await set(
    CACHE_KEY,
    JSON.stringify({ buster: BUSTER, timestamp: Date.now(), clientState: dehydrate(queryClient) }),
  );
}

/**
 * Entfernt den persistierten Query-Cache aus IndexedDB – Teil des Abmelde-Aufräumens
 * (utils/clearDeviceData): Abläufe mit Personennamen sollen auf geteilten Geräten nicht für
 * den nächsten Nutzer liegen bleiben.
 */
export async function clearPersistedCache(): Promise<void> {
  await del(CACHE_KEY);
}

/**
 * Diagnose für den Mehr-Tab: was liegt tatsächlich offline bereit? Zeigt, ob Persistenz +
 * Datei-Cache greifen (macht die bisher unsichtbare Offline-Reserve überprüfbar).
 */
export async function getOfflineStatus(): Promise<{
  files: number;
  records: number;
  savedAt: number | null;
}> {
  let files = 0;
  try {
    if (typeof caches !== 'undefined') {
      files = (await (await caches.open('worship-files')).keys()).length;
    }
  } catch {
    /* Cache nicht verfügbar */
  }
  let records = 0;
  let savedAt: number | null = null;
  try {
    const raw = await get<string>(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        timestamp?: number;
        clientState?: { queries?: unknown[] };
      };
      records = parsed.clientState?.queries?.length ?? 0;
      savedAt = parsed.timestamp ?? null;
    }
  } catch {
    /* kein persistierter Cache */
  }
  return { files, records, savedAt };
}
