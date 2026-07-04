import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Prüf-Intervall im Vordergrund. Zusätzlich wird bei jeder Rückkehr in den Vordergrund geprüft. */
const CHECK_INTERVAL_MS = 1000 * 60 * 60;

/** Ergebnis/Fortschritt einer manuellen Update-Suche (für den Knopf im „Mehr"-Tab). */
export type CheckState = 'idle' | 'checking' | 'updating' | 'up-to-date' | 'update-ready';

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

  const checkNow = useCallback(async () => {
    const reg = regRef.current;
    if (!reg) {
      // Kein Service Worker (z. B. Entwicklungsmodus) – ehrlich „aktuell" melden.
      setCheckState('up-to-date');
      window.setTimeout(() => setCheckState('idle'), 2500);
      return;
    }
    setCheckState('checking');
    try {
      // WICHTIG: die Prüfung ABWARTEN. Erst danach steht fest, ob ChurchTools/der Server eine
      // neue sw.js hat und ein neuer Worker zu installieren beginnt. (Der frühere Code gab nach
      // 2,5 s auf und meldete fälschlich „aktuell", bevor die neue Version sichtbar wurde.)
      await reg.update();
    } catch {
      // Offline o. ä. – nicht als „aktuell" verkaufen, einfach zurücksetzen.
      setCheckState('idle');
      return;
    }
    // Neuen Worker suchen; er taucht vereinzelt erst knapp nach dem Auflösen von update() auf,
    // daher bei Bedarf einmal kurz nachfassen.
    const find = (): ServiceWorker | null => reg.waiting ?? reg.installing ?? null;
    let worker = find();
    if (!worker) {
      await new Promise((r) => window.setTimeout(r, 1500));
      worker = find();
    }
    if (!worker) {
      setCheckState('up-to-date');
      window.setTimeout(() => setCheckState('idle'), 2500);
      return;
    }
    // Neue Version gefunden → direkt laden (statt auf den unzuverlässigen Balken zu warten).
    // `updateServiceWorker(true)` übernimmt die wartende Version und lädt die Seite neu. Das
    // braucht einen fertig installierten Worker; ist er noch am Installieren, warten wir darauf.
    setCheckState('updating');
    if (worker.state === 'installed') {
      void updateServiceWorker(true);
      return;
    }
    const w = worker;
    w.addEventListener('statechange', () => {
      if (w.state === 'installed') void updateServiceWorker(true);
    });
  }, [updateServiceWorker]);

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
