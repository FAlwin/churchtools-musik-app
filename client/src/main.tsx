import React from 'react';
import ReactDOM from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './App';
import { queryClient, persistOptions } from './queryClient';
import './styles/main.scss';

// iOS-PWA: zuverlässige App-Höhe. `window.innerHeight` trackt im Standalone-Modus beide
// Ausrichtungen korrekt (anders als `100dvh`, das beim Drehen hängen bleibt). Wert landet in
// der CSS-Variable `--app-h`, die `html { height: var(--app-h) }` (main.scss) nutzt.
function syncAppHeight(): void {
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
}
syncAppHeight();
window.addEventListener('resize', syncAppHeight);
window.addEventListener('orientationchange', syncAppHeight);
window.visualViewport?.addEventListener('resize', syncAppHeight);
// Beim Start/Wiederöffnen ist `window.innerHeight` teils noch transient (iOS-PWA) und es folgt
// kein Resize → Höhe bliebe falsch (dunkler Streifen unten). Daher mehrfach nachsetzen.
window.addEventListener('load', syncAppHeight);
window.addEventListener('pageshow', syncAppHeight);
requestAnimationFrame(syncAppHeight);
setTimeout(syncAppHeight, 250);

// NUR Entwicklung: Demos zum Prüfen (?demo=pdf für den ChordPro→PDF-Export). Im Produktiv-Build
// (import.meta.env.DEV === false) nie geladen.
const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo');
const DemoComp =
  demo === 'pdf'
    ? React.lazy(() => import('./dev/DemoPdf').then((m) => ({ default: m.DemoPdf })))
    : demo === 'chart'
      ? React.lazy(() => import('./dev/DemoChart').then((m) => ({ default: m.DemoChart })))
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
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {rootNode}
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
