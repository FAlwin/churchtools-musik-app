import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
