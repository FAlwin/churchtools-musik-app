import { describe, expect, it } from 'vitest';
import { beatsPerFlash, flashIndexAt, isPulsable, msPerBeat } from './bpmPulse';

/**
 * #145: Der Puls hat genau zwei Arten, falsch zu sein – und beide sind reine Rechnung.
 *
 *  - Er **läuft auseinander**: Das passiert, wenn der Schlag hochgezählt statt aus der verstrichenen
 *    Zeit abgeleitet wird. Der Test dagegen prüft einen späten Schlag, nicht den zweiten.
 *  - Er **blinkt zu schnell**: über drei Blitze je Sekunde (WCAG 2.3.1).
 */

describe('isPulsable – was überhaupt ein Tempo ist', () => {
  it('nimmt übliche Lied-Tempi an', () => {
    expect(isPulsable(72)).toBe(true);
    expect(isPulsable(140)).toBe(true);
  });

  it('lehnt fehlendes Tempo ab', () => {
    expect(isPulsable(null)).toBe(false);
    expect(isPulsable(undefined)).toBe(false);
  });

  it('lehnt Datenfehler ab, statt ein Stroboskop zu bauen', () => {
    expect(isPulsable(0)).toBe(false);
    expect(isPulsable(-60)).toBe(false);
    expect(isPulsable(5000)).toBe(false);
    expect(isPulsable(Number.NaN)).toBe(false);
    expect(isPulsable(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('msPerBeat', () => {
  it('rechnet 60 bpm in genau eine Sekunde um', () => {
    expect(msPerBeat(60)).toBe(1000);
  });

  it('rechnet 120 bpm in eine halbe Sekunde um', () => {
    expect(msPerBeat(120)).toBe(500);
  });
});

describe('flashIndexAt – der Puls darf NICHT auseinanderlaufen', () => {
  it('trifft auch den 1000. Schlag noch exakt', () => {
    // Der eigentliche Test gegen Drift: Bei einem hochgezählten Zähler wäre hier längst
    // Millisekunden-Fehler aufgelaufen. Aus der verstrichenen Zeit abgeleitet stimmt es immer.
    const bpm = 137; // krummes Tempo → msPerBeat ist keine glatte Zahl
    expect(flashIndexAt(1000 * msPerBeat(bpm), bpm)).toBe(1000);
    expect(flashIndexAt(1000 * msPerBeat(bpm) - 1, bpm)).toBe(999);
  });

  it('zählt vom Einschalten an bei null los', () => {
    expect(flashIndexAt(0, 120)).toBe(0);
    expect(flashIndexAt(-5, 120)).toBe(0); // Uhr springt zurück – kein negativer Blitz
  });

  it('wechselt genau an der Schlaggrenze', () => {
    expect(flashIndexAt(499, 120)).toBe(0);
    expect(flashIndexAt(500, 120)).toBe(1);
  });
});

describe('beatsPerFlash – nicht schneller als drei Blitze je Sekunde (WCAG 2.3.1)', () => {
  it('blinkt bei üblichen Tempi auf jedem Schlag', () => {
    expect(beatsPerFlash(72)).toBe(1);
    expect(beatsPerFlash(180)).toBe(1); // genau an der Grenze: 3/s ist noch erlaubt
  });

  it('halbiert oberhalb der Grenze', () => {
    expect(beatsPerFlash(181)).toBe(2);
    expect(beatsPerFlash(240)).toBe(2);
  });

  it('bleibt über den ganzen erlaubten Bereich unter drei Blitzen je Sekunde', () => {
    for (let bpm = 20; bpm <= 300; bpm++) {
      const proSekunde = bpm / beatsPerFlash(bpm) / 60;
      expect(proSekunde).toBeLessThanOrEqual(3);
    }
  });

  it('halbiert auch die Blitzfolge, nicht nur die Anzeige', () => {
    const bpm = 240; // 4 Schläge/s → jeder zweite = 2 Blitze/s
    const proBlitz = msPerBeat(bpm) * 2;
    expect(flashIndexAt(proBlitz - 1, bpm)).toBe(0);
    expect(flashIndexAt(proBlitz, bpm)).toBe(1);
  });
});
