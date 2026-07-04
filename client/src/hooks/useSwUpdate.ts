import { useRegisterSW } from 'virtual:pwa-register/react';

/** Prüf-Intervall im Vordergrund. Zusätzlich wird bei jeder Rückkehr in den Vordergrund geprüft. */
const CHECK_INTERVAL_MS = 1000 * 60 * 60;

/**
 * Meldet, wenn der Service Worker eine neue App-Version bereithält (`updateReady`), und stößt die
 * Suche danach aktiv an: beim Start, bei jeder Rückkehr in den Vordergrund und stündlich.
 *
 * Hintergrund: `registerType: 'prompt'` (vite.config.ts) lädt bewusst nie ungefragt neu – ohne
 * aktives Nachprüfen entdeckt aber gerade die iOS-PWA neue Versionen praktisch nie und Geräte
 * bleiben unbemerkt wochenlang auf altem Stand (so geschehen beim „keine Berechtigung"-Schloss,
 * dessen Fix die Geräte nie erreichte). `applyUpdate` übernimmt die wartende Version und lädt
 * die App neu; `dismiss` blendet den Hinweis bis zur nächsten Gelegenheit aus.
 */
export function useSwUpdate(): {
  updateReady: boolean;
  applyUpdate: () => void;
  dismiss: () => void;
} {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Fehler still schlucken: ohne Netz schlägt update() fehl, der nächste Versuch kommt ohnehin.
      const check = () => void registration.update().catch(() => {});
      // Läuft bewusst für die gesamte Lebensdauer der App – die SW-Registrierung tut das auch.
      setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  return {
    updateReady: needRefresh,
    applyUpdate: () => void updateServiceWorker(true),
    dismiss: () => setNeedRefresh(false),
  };
}
