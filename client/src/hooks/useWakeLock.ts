import { useEffect } from 'react';

/**
 * Hält das Display an, solange `enabled` true ist (Screen Wake Lock API).
 *
 * iOS/Browser geben die Sperre automatisch frei, sobald die Seite in den Hintergrund
 * geht (Tab-Wechsel, App wegschalten). Damit „Display anlassen" zuverlässig wirkt,
 * wird die Sperre beim Zurückkehren (visibilitychange) erneut angefordert.
 * No-op, wenn die API fehlt.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible' || sentinel) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        sentinel.addEventListener('release', () => {
          sentinel = null;
        });
      } catch {
        // z.B. niedriger Akku oder fehlende Berechtigung – still ignorieren
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}
