import React from 'react';
import ReactDOM from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './App';
import { queryClient, persistOptions } from './queryClient';
import { UpdateBanner } from './components/UpdateBanner';
import { RestoreGate } from './components/RestoreGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SwUpdateProvider } from './hooks/useSwUpdate';
import { initPwaInstall } from './services/pwaInstall';
import { syncAppHeight } from './utils/appHeight';
import './styles/main.scss';

// Früh registrieren: das `beforeinstallprompt`-Event feuert einmalig kurz nach dem Laden.
initPwaInstall();

// iOS-PWA: zuverlässige App-Höhe. `window.innerHeight` trackt im Standalone-Modus beide
// Ausrichtungen korrekt (anders als `100dvh`, das beim Drehen hängen bleibt). Wert landet in
// der CSS-Variable `--app-h`, die `html { height: var(--app-h) }` (main.scss) nutzt.
syncAppHeight();
window.addEventListener('resize', syncAppHeight);
window.addEventListener('orientationchange', syncAppHeight);
window.visualViewport?.addEventListener('resize', syncAppHeight);
// Nach dem Schließen der Tastatur (Blur) die ggf. übersprungene Höhen-Nachführung nachholen – und
// einen von iOS hinterlassenen Dokument-Scroll zurückholen (#207): iOS schiebt die SEITE hoch, um
// das fokussierte Feld über die Tastatur zu heben, scrollt danach aber nicht zurück. Da die App eine
// feste Höhe hat und nur innere Container scrollen, ist ein Dokument-Scroll immer ein Artefakt.
window.addEventListener('focusout', () =>
  setTimeout(() => {
    if (window.scrollY !== 0) window.scrollTo(0, 0);
    syncAppHeight();
  }, 50),
);
// Beim Start/Wiederöffnen ist `window.innerHeight` teils noch transient (iOS-PWA) und es folgt
// kein Resize → Höhe bliebe falsch (dunkler Streifen unten). Daher mehrfach nachsetzen.
window.addEventListener('load', syncAppHeight);
window.addEventListener('pageshow', syncAppHeight);
requestAnimationFrame(syncAppHeight);
setTimeout(syncAppHeight, 250);

// iOS-Safe-Area stabil halten (#187): iOS setzt `env(safe-area-inset-top)` beim Schließen eines
// modalen Dialogs kurz auf 0 zurück → Kopfleisten mit `max(20px, env(...))` schrumpfen im Transient
// und die ganze Leiste springt sichtbar. Wir messen den echten Wert über ein Probe-Element und
// halten ihn in der CSS-Variable `--sat` fest. Der gemerkte Wert kollabiert NICHT mit dem Transient;
// nur eine echte Orientierungsänderung darf ihn verkleinern (Querformat hat oben oft keine Safe-Area).
const satProbe = document.createElement('div');
satProbe.style.cssText =
  'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);';
document.body.appendChild(satProbe);
let satPx = 0;
function syncSafeAreaTop(allowDecrease = false): void {
  const v = parseFloat(getComputedStyle(satProbe).paddingTop) || 0;
  // Transiente Verkleinerungen (Modal-Schließen) ignorieren; nur bei echter Orientierungsänderung
  // (allowDecrease) den Wert senken.
  if (allowDecrease ? v !== satPx : v > satPx) {
    satPx = v;
    document.documentElement.style.setProperty('--sat', `${satPx}px`);
  }
}
syncSafeAreaTop();
window.addEventListener('load', () => syncSafeAreaTop());
window.addEventListener('pageshow', () => syncSafeAreaTop());
requestAnimationFrame(() => syncSafeAreaTop());
setTimeout(() => syncSafeAreaTop(), 300);
setTimeout(() => syncSafeAreaTop(), 1000);
window.addEventListener('orientationchange', () => setTimeout(() => syncSafeAreaTop(true), 350));

// NUR Entwicklung: Demos zum Prüfen (?demo=pdf für den ChordPro→PDF-Export). Im Produktiv-Build
// (import.meta.env.DEV === false) nie geladen.
const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo');
const DemoComp =
  demo === 'pdf'
    ? React.lazy(() => import('./dev/DemoPdf').then((m) => ({ default: m.DemoPdf })))
    : demo === 'chart'
      ? React.lazy(() => import('./dev/DemoChart').then((m) => ({ default: m.DemoChart })))
      : demo === 'editor'
        ? React.lazy(() => import('./dev/DemoEditor').then((m) => ({ default: m.DemoEditor })))
        : null;

const rootNode = DemoComp ? (
  <React.Suspense fallback={null}>
    <DemoComp />
  </React.Suspense>
) : (
  <App />
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* Fängt Start-/Render-Fehler ab → statt weißem Bildschirm eine Meldung mit Nachlade-Knopf. */}
    <ErrorBoundary>
      {/* PersistQueryClientProvider: wie QueryClientProvider, spiegelt den Query-Cache zusätzlich
          nach IndexedDB → einmal geladene Gottesdienste bleiben offline verfügbar (#32). */}
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        {/* Ein Provider umschließt App + Balken, damit beide denselben Service-Worker-Zustand teilen. */}
        <SwUpdateProvider>
          {/* Erst rendern, wenn der Offline-Cache wiederhergestellt ist (kein Login-Blitz beim Start). */}
          <RestoreGate>
            {rootNode}
            {/* Global (auch auf dem Login-Screen): Hinweis, sobald eine neue Version bereitliegt. */}
            <UpdateBanner />
          </RestoreGate>
        </SwUpdateProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
