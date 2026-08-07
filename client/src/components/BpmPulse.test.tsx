// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { BpmPulse } from './BpmPulse';
import { msPerBeat } from '../utils/bpmPulse';

/**
 * #145: Der Puls schlägt über `requestAnimationFrame`. Ihn im Browser „nachzuzählen" ist wertlos –
 * ein ausgeblendetes Fenster drosselt rAF, und genau darauf bin ich beim Bauen hereingefallen
 * (22 statt 72 Schläge je Minute gemessen, der Code war völlig in Ordnung).
 *
 * Deshalb hier mit **selbst gesteuerten Frames und selbst gesetzter Uhr**: Die Taktrate wird
 * gerechnet, nicht abgewartet. Das prüft genau das, was der Code tut, und hängt an keiner Umgebung.
 */
let jetzt = 0;
let warteschlange: FrameRequestCallback[] = [];
let abgebrochen: number[] = [];

/** Einen Frame nach `dt` Millisekunden ausliefern. */
function frame(dt: number) {
  jetzt += dt;
  const q = warteschlange;
  warteschlange = [];
  for (const cb of q) cb(jetzt);
}

/**
 * `ms` Millisekunden in 16-ms-Frames verstreichen lassen (wie ein 60-Hz-Bildschirm).
 *
 * **Jeder Frame in einem EIGENEN `act()`.** React schreibt Zustandsänderungen erst beim Verlassen
 * des Blocks ins DOM – steckten alle Frames in einem einzigen `act()`, sähe der Test zwischendurch
 * nie eine Änderung und zählte null Blitze. (Genau darauf bin ich beim Schreiben hereingefallen.)
 */
function laufenLassen(ms: number) {
  for (let v = 0; v < ms; v += 16) act(() => frame(16));
}

/** Zählt, wie oft der Punkt durch einen NEUEN Knoten ersetzt wurde = ein Blitz. */
function blitzeZaehlen(container: HTMLElement, ms: number): number {
  let letzter = container.querySelector('span');
  let blitze = 0;
  for (let v = 0; v < ms; v += 16) {
    act(() => frame(16));
    const aktuell = container.querySelector('span');
    if (aktuell && aktuell !== letzter) blitze++;
    letzter = aktuell;
  }
  return blitze;
}

beforeEach(() => {
  jetzt = 0;
  warteschlange = [];
  abgebrochen = [];
  vi.spyOn(performance, 'now').mockImplementation(() => jetzt);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    warteschlange.push(cb);
    return warteschlange.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (h: number) => abgebrochen.push(h));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('BpmPulse – wann er überhaupt erscheint', () => {
  it('zeigt nichts, solange er ausgeschaltet ist', () => {
    const { container } = render(<BpmPulse bpm={72} active={false} />);
    expect(container.querySelector('span')).toBeNull();
  });

  it('zeigt nichts, wenn im Lied kein Tempo gepflegt ist', () => {
    const { container } = render(<BpmPulse bpm={null} active={true} />);
    expect(container.querySelector('span')).toBeNull();
  });

  it('zeigt nichts bei einem unsinnigen Tempo aus ChurchTools', () => {
    const { container } = render(<BpmPulse bpm={5000} active={true} />);
    expect(container.querySelector('span')).toBeNull();
  });

  it('erscheint, sobald er eingeschaltet wird', () => {
    const { container } = render(<BpmPulse bpm={72} active={true} />);
    expect(container.querySelector('span')).not.toBeNull();
  });
});

describe('BpmPulse – der Takt stimmt', () => {
  it('blitzt bei 72 bpm sechsmal in fünf Sekunden', () => {
    const { container } = render(<BpmPulse bpm={72} active={true} />);
    expect(blitzeZaehlen(container, 5000)).toBe(6);
  });

  it('blitzt bei 120 bpm doppelt so oft wie bei 60', () => {
    const langsam = render(<BpmPulse bpm={60} active={true} />);
    const a = blitzeZaehlen(langsam.container, 4000);
    langsam.unmount();

    jetzt = 0;
    warteschlange = [];
    const schnell = render(<BpmPulse bpm={120} active={true} />);
    const b = blitzeZaehlen(schnell.container, 4000);

    expect(a).toBe(4);
    expect(b).toBe(8);
  });

  it('läuft auch nach zwei Minuten nicht aus dem Takt', () => {
    // Der eigentliche Drift-Test. Mit einem hochgezählten Zähler wäre hier Fehler aufgelaufen;
    // aus der verstrichenen Zeit abgeleitet steht der Blitz exakt am 144. Schlag.
    const bpm = 72;
    const { container } = render(<BpmPulse bpm={bpm} active={true} />);
    const vorGrenze = 144 * msPerBeat(bpm) - 20;
    laufenLassen(vorGrenze);
    const davor = container.querySelector('span');
    laufenLassen(40); // über die Grenze
    expect(container.querySelector('span')).not.toBe(davor);
  });

  it('blitzt bei sehr schnellen Liedern nur jeden zweiten Schlag (WCAG 2.3.1)', () => {
    // 240 bpm = 4 Schläge/s. Geblitzt wird halbiert → 2/s, also 8 in vier Sekunden.
    const { container } = render(<BpmPulse bpm={240} active={true} />);
    expect(blitzeZaehlen(container, 4000)).toBe(8);
  });
});

describe('BpmPulse – aufhören', () => {
  it('hält an, sobald er ausgeschaltet wird', () => {
    const { container, rerender } = render(<BpmPulse bpm={72} active={true} />);
    rerender(<BpmPulse bpm={72} active={false} />);
    expect(container.querySelector('span')).toBeNull();
    expect(abgebrochen.length).toBeGreaterThan(0);
  });

  it('meldet den Frame-Takt beim Verlassen ab', () => {
    const { unmount } = render(<BpmPulse bpm={72} active={true} />);
    unmount();
    expect(abgebrochen.length).toBeGreaterThan(0);
  });
});
