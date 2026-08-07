// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TempoMenu } from './TempoMenu';
import { MIN_TIPPS } from '../utils/tapTempo';

/**
 * Das Tempo-Menü führt drei Dinge zusammen, die sich in einem Punkt unterscheiden: Puls und Klick
 * gehören **nur mir**, das Tempo gilt für **alle**. Diese Grenze ist das Wichtigste an der
 * Komponente – deshalb prüfen die meisten Tests hier, dass der Speichern-Knopf nicht zu früh, nicht
 * ohne Berechtigung und nicht stillschweigend erscheint.
 *
 * Das Antippen läuft über `performance.now()`. Mit echten Zeiten wäre der Test von der Laufzeit der
 * Testumgebung abhängig – deshalb eine gestellte Uhr, die ich selbst weiterdrehe. So ist das
 * erwartete Ergebnis eine Rechnung und keine Schätzung.
 */
let jetzt = 0;
beforeEach(() => {
  jetzt = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => jetzt);
});
afterEach(() => vi.restoreAllMocks());

const standard = {
  bpm: 120 as number | null,
  puls: false,
  onPuls: vi.fn(),
  klick: 'aus' as const,
  onKlick: vi.fn(),
  darfSpeichern: true,
  onSpeichern: vi.fn().mockResolvedValue(undefined),
  onClose: vi.fn(),
};

function zeige(over: Partial<typeof standard> = {}) {
  const props = { ...standard, onSpeichern: vi.fn().mockResolvedValue(undefined), ...over };
  render(<TempoMenu {...props} />);
  return props;
}

/** `anzahl` Tipps im Abstand `abstandMs` – die gestellte Uhr wird dabei weitergedreht. */
function tippen(anzahl: number, abstandMs: number) {
  const knopf = screen.getByRole('button', { name: 'Tippen' });
  for (let i = 0; i < anzahl; i++) {
    fireEvent.click(knopf);
    jetzt += abstandMs;
  }
}

describe('TempoMenu – was angezeigt wird', () => {
  it('zeigt das Tempo des Lieds', () => {
    zeige();
    expect(screen.getByText('♩ 120')).toBeTruthy();
  });

  it('sagt es deutlich, wenn im Lied kein Tempo steht', () => {
    zeige({ bpm: null });
    expect(screen.getByText('kein Tempo')).toBeTruthy();
  });

  it('sperrt Puls und Klick ohne brauchbares Tempo – aber NICHT das Antippen', () => {
    // Genau dann will man antippen: Das Menü ist der einzige Weg, ein fehlendes Tempo zu ergänzen.
    zeige({ bpm: null });
    expect(screen.getByRole('button', { name: 'An' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Einzählen' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Tippen' }).hasAttribute('disabled')).toBe(false);
  });
});

describe('TempoMenu – Tempo antippen', () => {
  it('braucht mehr als einen Tipp – aus einem folgt kein Abstand', () => {
    zeige();
    tippen(1, 500);
    expect(screen.queryByText(/in ChurchTools speichern/)).toBeNull();
  });

  it('rechnet aus den Abständen das Tempo – 500 ms ergibt ♩ 120', () => {
    zeige();
    tippen(MIN_TIPPS, 500);
    expect(screen.getByRole('button', { name: /♩ 120 in ChurchTools speichern/ })).toBeTruthy();
  });

  it('„Zurück" verwirft die Tipps samt Speichern-Knopf', () => {
    zeige();
    tippen(MIN_TIPPS, 500);
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.queryByText(/in ChurchTools speichern/)).toBeNull();
  });
});

describe('TempoMenu – speichern gilt für alle', () => {
  it('bietet das Speichern erst an, wenn ein Tempo ermittelt ist', () => {
    zeige();
    expect(screen.queryByText(/in ChurchTools speichern/)).toBeNull();
  });

  it('bietet es NICHT an, wenn die Berechtigung fehlt – und sagt warum', () => {
    zeige({ darfSpeichern: false });
    tippen(MIN_TIPPS, 500);
    expect(screen.queryByText(/in ChurchTools speichern/)).toBeNull();
    expect(screen.getByText(/fehlt dir die Berechtigung/)).toBeTruthy();
  });

  it('reicht das angetippte Tempo weiter und schließt danach', async () => {
    const props = zeige();
    tippen(MIN_TIPPS, 500);
    fireEvent.click(screen.getByRole('button', { name: /in ChurchTools speichern/ }));
    await waitFor(() => expect(props.onSpeichern).toHaveBeenCalledWith(120));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it('BEHÄLT das angetippte Tempo, wenn das Speichern fehlschlägt (#270)', async () => {
    // Ein vorübergehender Fehler darf keine Arbeit zerstören. Das Antippen ist Arbeit: Wer im Takt
    // mitgetippt hat, soll nicht von vorn anfangen, nur weil ChurchTools kurz nicht wollte.
    const props = zeige({
      onSpeichern: vi.fn().mockRejectedValue(new Error('ChurchTools antwortet nicht')),
    });
    tippen(MIN_TIPPS, 500);
    fireEvent.click(screen.getByRole('button', { name: /in ChurchTools speichern/ }));

    await waitFor(() => expect(screen.getByText('ChurchTools antwortet nicht')).toBeTruthy());
    // Menü bleibt offen …
    expect(props.onClose).not.toHaveBeenCalled();
    // … und der Knopf steht weiter bereit, mit demselben Wert.
    expect(screen.getByRole('button', { name: /♩ 120 in ChurchTools speichern/ })).toBeTruthy();
  });
});

describe('TempoMenu – Puls und Klick gehören nur mir', () => {
  it('meldet den Puls nach oben, ohne etwas zu speichern', () => {
    const props = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'An' }));
    expect(props.onPuls).toHaveBeenCalledWith(true);
    expect(props.onSpeichern).not.toHaveBeenCalled();
  });

  it('meldet den Klick-Modus nach oben, ohne etwas zu speichern', () => {
    const props = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Dauerhaft' }));
    expect(props.onKlick).toHaveBeenCalledWith('dauerhaft');
    expect(props.onSpeichern).not.toHaveBeenCalled();
  });
});
