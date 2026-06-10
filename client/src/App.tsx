/**
 * Wurzel-Komponente. Steuert, welcher Screen angezeigt wird.
 * Die eigentlichen Screens folgen in Schritt 6 (Frontend Design & Logik).
 */
export default function App() {
  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--teal)',
          fontFamily: "'Candara', sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700 }}>Churchtools Musik App</div>
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>
          Grundgerüst steht – Screens folgen in Schritt 6.
        </div>
      </div>
    </div>
  );
}
