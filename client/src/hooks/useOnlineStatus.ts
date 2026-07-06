import { useEffect, useState } from 'react';
import { getReachable, subscribeReachable } from '../services/reachability';

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
    const on = () => setNavOnline(true);
    const off = () => setNavOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const unsub = subscribeReachable(setReachable);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      unsub();
    };
  }, []);

  // Kein Netz → sicher offline. Netz da, aber Server nicht erreichbar → ebenfalls offline behandeln.
  return navOnline && reachable;
}
