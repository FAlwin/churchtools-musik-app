/* eslint-disable react-refresh/only-export-components --
   Context + Provider + zugehöriger useSwUpdate-Hook sind bewusst kolokiert (Standard-Muster);
   nur relevant für Fast-Refresh-DX, kein Laufzeitbelang. */
import { createContext, useContext, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Prüf-Intervall im Vordergrund. Zusätzlich wird bei jeder Rückkehr in den Vordergrund geprüft. */
const CHECK_INTERVAL_MS = 1000 * 60 * 60;

interface SwUpdate {
  /** true, sobald eine neue Version bereitliegt (steuert den Hinweis-Balken). */
  updateReady: boolean;
  /** Übernimmt die wartende Version und lädt die App neu. */
  applyUpdate: () => void;
  /** Blendet den Hinweis-Balken bis zur nächsten Gelegenheit aus. */
  dismiss: () => void;
}

const Ctx = createContext<SwUpdate | null>(null);

/**
 * Zentrale Service-Worker-Update-Logik – EINMAL im Baum (Provider). Registriert den Service Worker
 * und prüft beim Start, bei Rückkehr in den Vordergrund und stündlich aktiv auf neue Versionen,
 * damit ein Kaltstart/Neu-Öffnen die neue Version bereits parat hat (der zuverlässige Weg auf iOS).
 * Liegt eine Version bereit, kann der Hinweis-Balken sie anzeigen. `registerType: 'prompt'`
 * (vite.config.ts) lädt bewusst nie ungefragt mitten in der Nutzung neu.
 */
export function SwUpdateProvider({ children }: { children: ReactNode }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Fehler still schlucken: ohne Netz schlägt update() fehl, der nächste Versuch kommt ohnehin.
      const check = () => void registration.update().catch(() => {});
      setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  const value: SwUpdate = {
    updateReady: needRefresh,
    applyUpdate: () => void updateServiceWorker(true),
    dismiss: () => setNeedRefresh(false),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Zugriff auf die geteilte Update-Logik. */
export function useSwUpdate(): SwUpdate {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSwUpdate muss innerhalb von <SwUpdateProvider> genutzt werden.');
  return ctx;
}
