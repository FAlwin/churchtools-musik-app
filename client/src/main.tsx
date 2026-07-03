import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/main.scss';

// iOS-PWA: zuverlässige App-Höhe. `window.innerHeight` trackt im Standalone-Modus beide
// Ausrichtungen korrekt (anders als `100dvh`, das beim Drehen hängen bleibt). Wert landet in
// der CSS-Variable `--app-h`, die `html { height: var(--app-h) }` (main.scss) nutzt.
function syncAppHeight(): void {
  // Bei geöffneter Tastatur (Eingabefeld fokussiert) NICHT mitschrumpfen: sonst reflowt die
  // GANZE App nach oben („alles verschiebt sich"). Das Freihalten des Cursors übernehmen die
  // Tastatur-Ausweich-Logiken in PageDeck/ChordEditor; nach dem Blur kommt ein Resize und
  // die Höhe wird wieder normal nachgeführt.
  const ae = document.activeElement as HTMLElement | null;
  if (ae && (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
}
syncAppHeight();
window.addEventListener('resize', syncAppHeight);
window.addEventListener('orientationchange', syncAppHeight);
window.visualViewport?.addEventListener('resize', syncAppHeight);
// Nach dem Schließen der Tastatur (Blur) die ggf. übersprungene Höhen-Nachführung nachholen.
window.addEventListener('focusout', () => setTimeout(syncAppHeight, 50));
// Beim Start/Wiederöffnen ist `window.innerHeight` teils noch transient (iOS-PWA) und es folgt
// kein Resize → Höhe bliebe falsch (dunkler Streifen unten). Daher mehrfach nachsetzen.
window.addEventListener('load', syncAppHeight);
window.addEventListener('pageshow', syncAppHeight);
requestAnimationFrame(syncAppHeight);
setTimeout(syncAppHeight, 250);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

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
    <QueryClientProvider client={queryClient}>{rootNode}</QueryClientProvider>
  </React.StrictMode>,
);
