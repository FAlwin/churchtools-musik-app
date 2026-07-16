import { Component, type ReactNode } from 'react';
import { isChunkLoadError, shouldReloadAfterChunkError } from '../utils/chunkReload';

/**
 * Fängt Render-/Start-Fehler ab, damit ein einzelner Fehler nie die GANZE App weiß macht (#32).
 * Zeigt stattdessen eine verständliche Meldung mit Nachlade-Knopf. Bewusst als Klassen-Komponente
 * (nur so lässt sich componentDidCatch nutzen) und ohne App-Abhängigkeiten (rein inline gestylt,
 * funktioniert also auch, wenn das Laden früh scheitert).
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; detail: string }
> {
  state = { hasError: false, detail: '' };

  static getDerivedStateFromError(error: unknown): { hasError: boolean; detail: string } {
    // Kurzfassung des echten Fehlers (Name + Meldung) → wird im Schirm angezeigt, damit ein
    // Screenshot zur Ferndiagnose reicht (die volle Meldung steht zusätzlich in der Konsole).
    const e = error as { name?: string; message?: string } | null;
    const detail =
      e && (e.name || e.message) ? `${e.name ?? 'Fehler'}: ${e.message ?? ''}` : String(error);
    return { hasError: true, detail: detail.slice(0, 300) };
  }

  componentDidCatch(error: unknown): void {
    // Für die Fehlersuche in der Konsole (kein externes Logging).
    console.error('App-Startfehler abgefangen:', error);
    // Nach einem Deploy zeigt die noch laufende (alte) index.html auf entfernte Chunk-Dateien →
    // ein dynamischer Import scheitert. Solche Chunk-Fehler EINMAL still per Neuladen selbst heilen
    // (Cooldown gegen Endlosschleife), statt dem Nutzer den Schirm zuzumuten. Ergänzt withChunkReload
    // für Fälle, die dessen Lazy-Grenze entkommen. Andere Fehler bleiben sichtbar.
    if (isChunkLoadError(error) && shouldReloadAfterChunkError()) {
      window.location.reload();
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#556',
          background: '#f5f6f8',
        }}
      >
        <div style={{ fontSize: 15, maxWidth: 320 }}>
          Die App konnte nicht richtig starten. Bitte neu laden – bei bestehender Verbindung wird
          alles aktualisiert.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            fontSize: 15,
            border: 'none',
            borderRadius: 8,
            background: '#0061a1',
            color: '#fff',
          }}
        >
          Neu laden
        </button>
        {this.state.detail && (
          <div
            style={{
              fontSize: 11,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              color: '#8a93a0',
              maxWidth: 320,
              wordBreak: 'break-word',
            }}
          >
            {this.state.detail}
          </div>
        )}
      </div>
    );
  }
}
