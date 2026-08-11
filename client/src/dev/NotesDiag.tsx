/**
 * ⚠️ VORÜBERGEHENDE DIAGNOSE – nach der Klärung ERSATZLOS ENTFERNEN.
 *
 * Zweck: Alwin meldet am 11.08.2026, dass die Anmerkungen eines Kollegen auswählbar sind, aber
 * „gar nichts erscheint". Aus dem Code allein ließ sich nicht entscheiden, ob der Schlüssel nicht
 * passt oder der Spiegel leer ist – deshalb zeigt dieses Feld **beide Seiten gleichzeitig**:
 * unter welchem Schlüssel gesucht wird, und was tatsächlich im Spiegel liegt.
 *
 * Eingeschaltet über `?diag=notizen`. Ohne den Parameter existiert nichts davon.
 *
 * **Lehren aus der Zoom-Diagnose (#319), hier von Anfang an beachtet:**
 * - `createPortal` an `document.body`: `position: fixed` greift in einem transformierten Vorfahren
 *   nicht – das Feld war damals unsichtbar.
 * - Einklappbar und unten links: Ein Feld über den Knöpfen macht die App unbedienbar, und dann
 *   kann Alwin genau das nicht testen, worum es geht.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';

export interface NotesDiagPage {
  page: number;
  ownerSongId: number | null;
  ownerVersionKey: string | null;
  ownerLocalPage: number | null;
  ownerArrangementId: number | null;
  /** Der Schlüssel, unter dem die App die fremden Striche SUCHT. */
  viewKey: string | null;
  /** Liegt dort wirklich etwas? Das ist die Antwort auf „warum sehe ich nichts". */
  gefunden: boolean;
}

interface NotesDiagProps {
  viewing: {
    songId: number;
    versionKey: string;
    lyr: boolean;
    arrangementId: number | null;
  } | null;
  pages: NotesDiagPage[];
  /** Alle Schlüssel im Ansichts-Spiegel (ohne Namensraum-Präfix). */
  mirrorKeys: string[];
}

const box: React.CSSProperties = {
  position: 'fixed',
  left: 8,
  bottom: 8,
  zIndex: 9999,
  maxWidth: 'min(92vw, 560px)',
  maxHeight: '46vh',
  overflow: 'auto',
  background: 'rgba(0,0,0,0.86)',
  color: '#fff',
  font: '11px/1.45 ui-monospace, Menlo, monospace',
  padding: '6px 8px',
  borderRadius: 6,
  WebkitUserSelect: 'text',
  userSelect: 'text',
};

export function NotesDiag({ viewing, pages, mirrorKeys }: NotesDiagProps) {
  const [offen, setOffen] = useState(true);
  const treffer = pages.filter((p) => p.gefunden).length;

  return createPortal(
    <div style={box}>
      <button
        onClick={() => setOffen((o) => !o)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'block',
          width: '100%',
          fontWeight: 700,
        }}
      >
        {offen ? '▾' : '▸'} Diagnose Notizen —{' '}
        {viewing ? `${treffer}/${pages.length} gefunden` : 'nicht am Ansehen'}
      </button>

      {offen && (
        <>
          <div style={{ marginTop: 4 }}>
            <b>Angesehene Ebene:</b>{' '}
            {viewing
              ? `Lied ${viewing.songId} · Version "${viewing.versionKey}" · ${viewing.lyr ? 'nur Text' : 'Akkorde'} · Arrangement ${viewing.arrangementId ?? '—'}`
              : '—'}
          </div>

          <div style={{ marginTop: 4 }}>
            <b>Gesucht wird unter:</b>
            {pages.length === 0 && <div>— keine Seite mit Besitzer —</div>}
            {pages.map((p) => (
              <div key={p.page} style={{ color: p.gefunden ? '#8f8' : '#f99' }}>
                S{p.page}: {p.viewKey ?? '(kein Schlüssel)'} {p.gefunden ? '✓' : '✗'}
                <span style={{ opacity: 0.6 }}>
                  {' '}
                  [Besitzer: Lied {p.ownerSongId ?? '—'} · v{p.ownerVersionKey ?? '—'} · Seite{' '}
                  {p.ownerLocalPage ?? '—'} · Arr {p.ownerArrangementId ?? '—'}]
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 4 }}>
            <b>Im Spiegel liegen ({mirrorKeys.length}):</b>
            {mirrorKeys.length === 0 && <div style={{ color: '#f99' }}>— leer —</div>}
            {mirrorKeys.map((k) => (
              <div key={k} style={{ opacity: 0.85 }}>
                {k}
              </div>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
