import { describe, expect, it } from 'vitest';
import {
  MAX_ABSTAENDE,
  MIN_TAP_BPM,
  NEUSTART_NACH_MS,
  aktuelleSerie,
  tempoAusTipps,
} from './tapTempo';
import { MAX_BPM, MIN_BPM } from './bpmPulse';

/**
 * Tempo durch Antippen: Das Ergebnis landet am Ende in ChurchTools und gilt dort **für alle**.
 * Deshalb ist die wichtigste Eigenschaft nicht Genauigkeit, sondern dass **kein Unsinn durchkommt**.
 */

/** Tipps in gleichmäßigem Abstand `ms`, beginnend bei `start`. */
const gleichmaessig = (anzahl: number, ms: number, start = 1000): number[] =>
  Array.from({ length: anzahl }, (_, i) => start + i * ms);

describe('tempoAusTipps – der Normalfall', () => {
  it('macht aus Sekundenabständen 60 Schläge', () => {
    expect(tempoAusTipps(gleichmaessig(5, 1000))).toBe(60);
  });

  it('macht aus halben Sekunden 120', () => {
    expect(tempoAusTipps(gleichmaessig(5, 500))).toBe(120);
  });

  it('rundet auf ganze Schläge – ChurchTools führt keine Nachkommastellen', () => {
    // 512 ms ≈ 117,2 bpm
    expect(tempoAusTipps(gleichmaessig(6, 512))).toBe(117);
  });
});

describe('tempoAusTipps – wann es (noch) nichts liefert', () => {
  it('schweigt bei zu wenigen Tipps', () => {
    expect(tempoAusTipps([])).toBeNull();
    expect(tempoAusTipps([1000])).toBeNull();
    expect(tempoAusTipps([1000, 1500])).toBeNull();
  });

  it('liefert ab dem dritten Tipp ein Ergebnis', () => {
    expect(tempoAusTipps([1000, 1500, 2000])).toBe(120);
  });

  it('lehnt ein unplausibel schnelles Ergebnis ab, statt es anzubieten', () => {
    // 100 ms Abstand = 600 bpm
    expect(tempoAusTipps(gleichmaessig(5, 100))).toBeNull();
  });

  it('kann Schleichtempi gar nicht erst ermitteln – und sagt das über MIN_TAP_BPM', () => {
    // Langsamer als 30 bpm heißt: jeder Abstand ist länger als die Pausengrenze, jeder Tipp
    // beginnt eine neue Serie. Der Grenzwert ist deshalb ausgerechnet, nicht geraten.
    expect(MIN_TAP_BPM).toBe(Math.ceil(60_000 / NEUSTART_NACH_MS));
    expect(MIN_TAP_BPM).toBeGreaterThan(MIN_BPM);
    expect(tempoAusTipps(gleichmaessig(5, 60_000 / 24))).toBeNull();
  });

  it('bleibt über den ANTIPPBAREN Bereich hinweg im Rahmen', () => {
    for (const bpm of [MIN_TAP_BPM, 60, 120, MAX_BPM]) {
      const wert = tempoAusTipps(gleichmaessig(6, 60_000 / bpm));
      expect(wert).not.toBeNull();
      expect(wert).toBeGreaterThanOrEqual(MIN_BPM);
      expect(wert).toBeLessThanOrEqual(MAX_BPM);
    }
  });
});

describe('aktuelleSerie – nach einer Pause fängt man neu an', () => {
  it('verwirft alles vor einer längeren Pause', () => {
    // Drei Tipps, dann fünf Sekunden Pause, dann drei neue.
    const tipps = [...gleichmaessig(3, 500, 0), ...gleichmaessig(3, 500, 6000)];
    expect(aktuelleSerie(tipps)).toEqual([6000, 6500, 7000]);
  });

  it('lässt eine durchgehende Serie unangetastet', () => {
    const tipps = gleichmaessig(5, 500);
    expect(aktuelleSerie(tipps)).toEqual(tipps);
  });

  it('rechnet die Pause NICHT als Abstand mit – sonst käme ein viel zu langsames Tempo heraus', () => {
    const tipps = [...gleichmaessig(3, 500, 0), ...gleichmaessig(4, 500, 6000)];
    // Ohne den Neustart läge ein 5-Sekunden-Abstand im Mittel → deutlich unter 120.
    expect(tempoAusTipps(tipps)).toBe(120);
  });
});

describe('tempoAusTipps – Robustheit', () => {
  it('lässt sich von einem einzelnen Ausrutscher nur wenig verziehen', () => {
    // Sauber 120 bpm, aber ein Tipp kommt 150 ms zu spät.
    const tipps = [1000, 1500, 2000, 2650, 3150, 3650, 4150];
    const wert = tempoAusTipps(tipps);
    expect(wert).not.toBeNull();
    expect(Math.abs((wert as number) - 120)).toBeLessThanOrEqual(8);
  });

  it('berücksichtigt höchstens die letzten Abstände – ein alter Teil zieht nicht ewig mit', () => {
    // Erst lange langsam (1000 ms), dann klar schneller (400 ms) – ohne Pause dazwischen.
    const langsam = gleichmaessig(6, 1000, 0);
    const schnell = gleichmaessig(MAX_ABSTAENDE + 1, 400, langsam[langsam.length - 1] + 400);
    const wert = tempoAusTipps([...langsam, ...schnell]);
    expect(wert).toBe(150); // 400 ms → 150 bpm; das langsame Vorspiel fällt aus dem Fenster
  });
});
