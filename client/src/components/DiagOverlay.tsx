import { useEffect, useState } from 'react';
import { diagAn, diagHoeren, diagZeilen } from '../utils/diagnose';

/**
 * Zeigt das Diagnose-Protokoll unten am Bildschirm – nur mit `?diag=zoom` (siehe `utils/diagnose`).
 *
 * Bewusst eine schlichte Liste ohne Gestaltung: Sie soll ablesbar und vorlesbar sein, nicht schön.
 * Die **Zeitabstände** sind die Auskunft, deshalb steht die Millisekunde vorn.
 *
 * Vorübergehend – fliegt mit der Klärung des Zoom-Fehlers wieder raus.
 */
export function DiagOverlay() {
  const [, neu] = useState(0);

  useEffect(() => {
    if (!diagAn) return;
    diagHoeren(() => neu((n) => n + 1));
    return () => diagHoeren(null);
  }, []);

  if (!diagAn) return null;
  const zeilen = diagZeilen();

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '38vh',
        overflowY: 'auto',
        background: 'rgba(0,0,0,.86)',
        color: '#0f0',
        font: '11px/1.45 ui-monospace, monospace',
        padding: '6px 8px',
        zIndex: 9999,
        whiteSpace: 'pre',
      }}
    >
      {zeilen.length === 0 ? 'Diagnose läuft – jetzt pinchen und in die Mitte tippen.' : null}
      {zeilen.map((z, i) => (
        <div key={i}>
          {String(z.ms).padStart(6)} ms {z.text}
        </div>
      ))}
    </div>
  );
}
