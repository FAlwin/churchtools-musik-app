import { Component, type ReactNode } from 'react';

/**
 * Fängt Render-/Start-Fehler ab, damit ein einzelner Fehler nie die GANZE App weiß macht (#32).
 * Zeigt stattdessen eine verständliche Meldung mit Nachlade-Knopf. Bewusst als Klassen-Komponente
 * (nur so lässt sich componentDidCatch nutzen) und ohne App-Abhängigkeiten (rein inline gestylt,
 * funktioniert also auch, wenn das Laden früh scheitert).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    // Für die Fehlersuche in der Konsole (kein externes Logging).
    console.error('App-Startfehler abgefangen:', error);
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
      </div>
    );
  }
}
