import { useEffect } from 'react';

/**
 * Hält das Display an, solange `enabled` true ist (Screen Wake Lock API).
 * Gibt die Sperre beim Aufräumen frei. No-op, wenn die API fehlt.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let active = true;
    let sentinel: WakeLockSentinel | null = null;
    navigator.wakeLock
      .request('screen')
      .then((lock) => {
        if (active) sentinel = lock;
        else lock.release().catch(() => {});
      })
      .catch(() => {});
    return () => {
      active = false;
      if (sentinel) sentinel.release().catch(() => {});
    };
  }, [enabled]);
}
