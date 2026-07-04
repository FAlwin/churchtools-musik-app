import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Prüf-Intervall im Vordergrund. Zusätzlich wird bei jeder Rückkehr in den Vordergrund geprüft. */
const CHECK_INTERVAL_MS = 1000 * 60 * 60;

/** Ergebnis einer manuellen Update-Suche (für den Knopf im „Mehr"-Tab). */
export type CheckState = 'idle' | 'checking' | 'up-to-date' | 'update-ready';

interface SwUpdate {
  /** true, sobald eine neue Version bereitliegt (steuert den Hinweis-Balken). */
  updateReady: boolean;
  /** Übernimmt die wartende Version und lädt die App neu. */
  applyUpdate: () => void;
  /** Blendet den Hinweis-Balken bis zur nächsten Gelegenheit aus. */
  dismiss: () => void;
  /** Ergebnis/Fortschritt der letzten manuellen Suche. */
  checkState: CheckState;
  /** Stößt eine sofortige Update-Suche an (Knopf „Nach Updates suchen"). */
  checkNow: () => void;
}

const Ctx = createContext<SwUpdate | null>(null);

/**
 * Zentrale Service-Worker-Update-Logik – EINMAL im Baum (Provider), damit Hinweis-Balken und
 * der Knopf im „Mehr"-Tab denselben Zustand teilen (`useRegisterSW` darf nur einmal laufen).
 *
 * Hintergrund: `registerType: 'prompt'` (vite.config.ts) lädt bewusst nie ungefragt neu. Ohne
 * aktives Nachprüfen entdeckt gerade die iOS-PWA neue Versionen aber unzuverlässig – daher
 * prüfen wir beim Start, bei Rückkehr in den Vordergrund, stündlich und auf Knopfdruck.
 */
export function SwUpdateProvider({ children }: { children: ReactNode }) {
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      regRef.current = registration;
      const check = () => void registration.update().catch(() => {});
      setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  const checkNow = useCallback(() => {
    const reg = regRef.current;
    if (!reg) {
      // Kein Service Worker (z. B. Entwicklungsmodus) – ehrlich „aktuell" melden.
      setCheckState('up-to-date');
      window.setTimeout(() => setCheckState('idle'), 2500);
      return;
    }
    setCheckState('checking');
    const startedAt = Date.now();
    void reg.update().catch(() => {});
    // Nach der Prüfung taucht eine neue Version als installing→waiting auf; kurz nachverfolgen.
    const poll = () => {
      if (reg.waiting) {
        setCheckState('update-ready');
        return;
      }
      if (reg.installing || Date.now() - startedAt < 2500) {
        window.setTimeout(poll, 400);
        return;
      }
      setCheckState('up-to-date');
      window.setTimeout(() => setCheckState('idle'), 2500);
    };
    window.setTimeout(poll, 400);
  }, []);

  // Sobald eine Version bereitliegt, den Knopf-Status mitziehen.
  useEffect(() => {
    if (needRefresh) setCheckState('update-ready');
  }, [needRefresh]);

  const value: SwUpdate = {
    updateReady: needRefresh,
    applyUpdate: () => void updateServiceWorker(true),
    dismiss: () => setNeedRefresh(false),
    checkState,
    checkNow,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Zugriff auf die geteilte Update-Logik. */
export function useSwUpdate(): SwUpdate {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSwUpdate muss innerhalb von <SwUpdateProvider> genutzt werden.');
  return ctx;
}
