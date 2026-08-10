// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMetronome, type KlickModus } from './useMetronome';
import { beatTimeSec } from '../utils/metronome';
import { msPerBeat } from '../utils/bpmPulse';

/**
 * #145 Folge-Wunsch: Ein Metronom lässt sich nicht „anhören" – prüfbar sind aber die **eingeplanten
 * Zeitpunkte**, und genau dort entscheidet sich alles:
 *
 *  - **Die Klicks liegen auf der Audio-Uhr, nicht auf dem Bildtakt.** Ein verspäteter Timer darf sie
 *    nicht verschieben; sie sind ja schon angemeldet.
 *  - **Die Eins ist betont.** Ohne sie ist ein Klick nur Ticken und sagt nicht, wo der Takt beginnt.
 *  - **Einzählen hört von selbst auf**, Dauerbetrieb nicht.
 */

interface Geplant {
  zeit: number;
  frequenz: number;
}

let uhr = 0;
let geplant: Geplant[] = [];
let geschlossen = 0;

/** Ein Audio-System, das nur mitschreibt, was wann klingen SOLL. */
class FakeAudioContext {
  get currentTime() {
    return uhr;
  }
  destination = {};
  resume = vi.fn();
  close = vi.fn(() => {
    geschlossen++;
    return Promise.resolve();
  });
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: (z: unknown) => z,
    };
  }
  createOscillator() {
    const ton = {
      frequency: { value: 0 },
      connect: (z: { connect: (x: unknown) => unknown }) => z,
      start: (zeit: number) => geplant.push({ zeit, frequenz: ton.frequency.value }),
      stop: vi.fn(),
    };
    return ton;
  }
}

/** Zeit verstreichen lassen: Audio-Uhr UND Timer bewegen sich gemeinsam. */
function laufen(sekunden: number) {
  const schritte = Math.round((sekunden * 1000) / 25);
  for (let i = 0; i < schritte; i++) {
    uhr += 0.025;
    act(() => void vi.advanceTimersByTime(25));
  }
}

function starte(
  modus: KlickModus,
  bpm: number | null = 120,
  timeSig: string | null = '4/4',
  taktStartMs: number | null = null,
) {
  const onEnde = vi.fn();
  return {
    ...renderHook(() => useMetronome({ bpm, timeSig, modus, taktStartMs, onEnde })),
    onEnde,
  };
}

beforeEach(() => {
  uhr = 0;
  geplant = [];
  geschlossen = 0;
  vi.useFakeTimers();
  // `performance.now()` an dieselbe gestellte Uhr hängen (in ms): Der Klick rechnet den Nullpunkt
  // des gemeinsamen Rasters von dort auf die Audio-Uhr um; mit echter Zeit wäre der Versatz Zufall.
  vi.spyOn(performance, 'now').mockImplementation(() => uhr * 1000);
  vi.stubGlobal('AudioContext', FakeAudioContext);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useMetronome – wann überhaupt geklickt wird', () => {
  it('schweigt im Modus „aus"', () => {
    starte('aus');
    laufen(2);
    expect(geplant).toHaveLength(0);
  });

  it('schweigt ohne brauchbares Tempo', () => {
    starte('dauerhaft', null);
    laufen(2);
    expect(geplant).toHaveLength(0);
  });

  it('schweigt bei einem unsinnigen Tempo aus ChurchTools', () => {
    starte('dauerhaft', 5000);
    laufen(2);
    expect(geplant).toHaveLength(0);
  });
});

describe('useMetronome – der Takt', () => {
  it('plant bei 120 bpm alle 500 ms einen Klick', () => {
    starte('dauerhaft', 120);
    laufen(2);
    expect(geplant.length).toBeGreaterThanOrEqual(4);
    const abstand = geplant[1].zeit - geplant[0].zeit;
    expect(abstand).toBeCloseTo(msPerBeat(120) / 1000, 5);
  });

  it('legt die Zeitpunkte EXAKT auf die Schläge – auch spät, ohne Aufsummieren', () => {
    starte('dauerhaft', 137); // krummes Tempo → kein glatter Abstand
    laufen(6);
    const start = geplant[0].zeit;
    geplant.forEach((g, i) => {
      expect(g.zeit - start).toBeCloseTo(beatTimeSec(i, 137), 6);
    });
  });

  it('plant IM VORAUS – ein Klick steht fest, BEVOR er klingt', () => {
    starte('dauerhaft', 120);
    // Kurz vor dem zweiten Schlag (bei 0,55 s): Er muss schon angemeldet sein, obwohl er erst
    // gleich klingt. Genau das macht den Klick unempfindlich gegen einen verspäteten Timer.
    laufen(0.5);
    expect(geplant.some((g) => g.zeit > uhr)).toBe(true);
  });
});

describe('useMetronome – die betonte Eins', () => {
  it('betont jeden Taktanfang und sonst nichts', () => {
    starte('dauerhaft', 120, '4/4');
    laufen(3);
    const hoch = geplant[0].frequenz;
    const tief = geplant[1].frequenz;
    expect(hoch).toBeGreaterThan(tief);
    geplant.slice(0, 8).forEach((g, i) => {
      expect(g.frequenz).toBe(i % 4 === 0 ? hoch : tief);
    });
  });

  it('folgt der Taktart – im Dreier liegt die Betonung anders', () => {
    starte('dauerhaft', 120, '3/4');
    laufen(3);
    const hoch = geplant[0].frequenz;
    expect(geplant[3].frequenz).toBe(hoch); // vierter Schlag = neue Eins
    expect(geplant[4].frequenz).not.toBe(hoch);
  });
});

describe('useMetronome – Einzählen hört von selbst auf', () => {
  it('klickt zwei Takte und meldet dann das Ende', () => {
    const { onEnde } = starte('einzaehlen', 120, '4/4');
    laufen(6);
    expect(geplant).toHaveLength(8); // 2 Takte à 4 Schläge
    expect(onEnde).toHaveBeenCalledTimes(1);
  });

  it('richtet sich dabei nach der Taktart', () => {
    starte('einzaehlen', 120, '3/4');
    laufen(6);
    expect(geplant).toHaveLength(6);
  });

  it('hört im Dauerbetrieb NICHT auf', () => {
    const { onEnde } = starte('dauerhaft', 120, '4/4');
    laufen(8);
    expect(geplant.length).toBeGreaterThan(8);
    expect(onEnde).not.toHaveBeenCalled();
  });
});

describe('useMetronome – aufhören', () => {
  it('schließt das Audio-System beim Verlassen', () => {
    const { unmount } = starte('dauerhaft');
    laufen(1);
    unmount();
    expect(geschlossen).toBe(1);
  });

  it('plant nach dem Verlassen nichts mehr', () => {
    const { unmount } = starte('dauerhaft');
    laufen(1);
    unmount();
    const vorher = geplant.length;
    laufen(2);
    expect(geplant).toHaveLength(vorher);
  });
});

describe('useMetronome – gemeinsames Raster mit dem sichtbaren Puls', () => {
  it('steigt in ein LAUFENDES Raster ein, statt bei sich selbst anzufangen', () => {
    // Das Raster läuft seit 1,2 s (Nullpunkt 0 ms), 120 bpm = 0,5 s je Schlag. Der Klick darf
    // deshalb nicht bei 1,2 s beginnen, sondern erst beim nächsten Rasterschlag: 1,5 s.
    // Genau das war gemeldet – Puls und Klick liefen sonst um 0,3 s versetzt.
    uhr = 1.2;
    starte('dauerhaft', 120, '4/4', 0);
    laufen(1);
    expect(geplant.length).toBeGreaterThan(0);
    expect(geplant[0].zeit).toBeCloseTo(1.5, 3);
  });

  it('legt jeden Klick auf einen Rasterschlag – auch nach mehreren Sekunden', () => {
    uhr = 1.2;
    starte('dauerhaft', 120, '4/4', 0);
    laufen(3);
    for (const g of geplant) {
      const schlag = g.zeit / beatTimeSec(1, 120);
      expect(Math.abs(schlag - Math.round(schlag))).toBeLessThan(1e-6);
    }
  });

  it('betont die Eins des RASTERS, nicht den eigenen ersten Klick', () => {
    // Einstieg bei Schlag 3 (1,5 s): Der erste Klick ist die Vier des Takts und darf NICHT betont
    // sein; betont ist erst Schlag 4 bei 2,0 s.
    uhr = 1.2;
    starte('dauerhaft', 120, '4/4', 0);
    laufen(1.2);
    expect(geplant[0].zeit).toBeCloseTo(1.5, 3);
    expect(geplant[0].frequenz).toBe(800);
    expect(geplant[1].zeit).toBeCloseTo(2.0, 3);
    expect(geplant[1].frequenz).toBe(1600);
  });

  it('beginnt das Einzählen auf einer EINS, nicht mitten im Takt', () => {
    // Einstieg bei Schlag 3 → aufgerundet auf Schlag 4 = 2,0 s, und der ist betont.
    uhr = 1.2;
    starte('einzaehlen', 120, '4/4', 0);
    laufen(1.2);
    expect(geplant[0].zeit).toBeCloseTo(2.0, 3);
    expect(geplant[0].frequenz).toBe(1600);
  });

  it('zählt auch beim Einstieg volle zwei Takte ein, nicht weniger', () => {
    uhr = 1.2;
    const { onEnde } = starte('einzaehlen', 120, '4/4', 0);
    laufen(6);
    // Zwei Takte à vier Schläge, beginnend bei Schlag 4.
    expect(geplant.length).toBe(8);
    expect(onEnde).toHaveBeenCalled();
  });
});
