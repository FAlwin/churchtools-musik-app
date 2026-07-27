import { useEffect, useState } from 'react';
import { getReachable, subscribeReachable, probeReachable } from '../services/reachability';

/**
 * Ist die App WIRKLICH online? Kombiniert zwei Signale:
 *  - `navigator.onLine`: ist überhaupt ein Netz da (Flugmodus → false),
 *  - Server-Erreichbarkeit aus echten API-Aufrufen (services/reachability): erreichen wir das
 *    Backend? Nötig, weil im Gemeinde-WLAN ohne Internet `navigator.onLine` fälschlich `true` meldet.
 * Online = beides erfüllt. Sobald wieder Netz da ist, geben wir „online" frei; ein fehlgeschlagener
 * Abruf setzt es wieder zurück (self-healing über die laufenden Queries).
 */
export function useOnlineStatus(): boolean {
  const [navOnline, setNavOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [reachable, setReachable] = useState(getReachable);

  useEffect(() => {
    // Netz zurück → AKTIV nachsehen, ob der Server antwortet (#218). Ohne das blieb `reachable`
    // auf false hängen, sobald keine Query mehr lief (z. B. auf dem Login-Screen): Der
    // Offline-Hinweis klebte, und nur ein App-Neustart brachte die App zurück.
    const on = () => {
      setNavOnline(true);
      void probeReachable();
    };
    const off = () => setNavOnline(false);
    // Gleiches beim Zurückkehren in die App: Auf dem iPhone wird die PWA pausiert, während sich
    // das WLAN ändert – ein `online`-Event kommt dann evtl. gar nicht mehr an.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setNavOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
      if (!getReachable()) void probeReachable();
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    document.addEventListener('visibilitychange', onVisible);
    const unsub = subscribeReachable(setReachable);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', onVisible);
      unsub();
    };
  }, []);

  // Kein Netz → sicher offline. Netz da, aber Server nicht erreichbar → ebenfalls offline behandeln.
  return navOnline && reachable;
}
