import { describe, expect, it } from 'vitest';
import {
  COUNT_IN_BARS,
  DEFAULT_BEATS_PER_BAR,
  beatTimeSec,
  beatsPerBar,
  countInBeats,
  countInDone,
  einzaehlStart,
  erstesSchlagAb,
  isAccent,
} from './metronome';

/**
 * Die Taktart kommt aus ChurchTools und ist damit alles andere als verlässlich – sie kann fehlen,
 * sauber sein („4/4"), Leerzeichen enthalten oder Unsinn. Der Klick darf deswegen nie ausfallen:
 * Lieber im Viervierteltakt zählen als gar nicht.
 */

describe('beatsPerBar – aus einer unzuverlässigen Angabe etwas Brauchbares machen', () => {
  it('liest den Zähler', () => {
    expect(beatsPerBar('4/4')).toBe(4);
    expect(beatsPerBar('3/4')).toBe(3);
    expect(beatsPerBar('6/8')).toBe(6);
  });

  it('verträgt Leerzeichen', () => {
    expect(beatsPerBar(' 3 / 4 ')).toBe(3);
  });

  it('fällt auf den Viervierteltakt zurück, wenn nichts Brauchbares kommt', () => {
    for (const murks of [null, undefined, '', 'C', 'vier viertel', '4', '/4', '0/4', '99/4']) {
      expect(beatsPerBar(murks)).toBe(DEFAULT_BEATS_PER_BAR);
    }
  });
});

describe('countInBeats – wie lange eingezählt wird', () => {
  it('zählt zwei Takte ein', () => {
    expect(countInBeats('4/4')).toBe(2 * 4);
    expect(countInBeats('3/4')).toBe(2 * 3);
    expect(COUNT_IN_BARS).toBe(2);
  });

  it('nimmt auch ohne Angabe zwei Vierertakte', () => {
    expect(countInBeats(null)).toBe(8);
  });
});

describe('isAccent – die betonte Eins', () => {
  it('betont jeden Taktanfang', () => {
    expect(isAccent(0, 4)).toBe(true);
    expect(isAccent(4, 4)).toBe(true);
    expect(isAccent(8, 4)).toBe(true);
  });

  it('betont die übrigen Schläge nicht', () => {
    expect(isAccent(1, 4)).toBe(false);
    expect(isAccent(3, 4)).toBe(false);
  });

  it('folgt der Taktart – im Dreier liegt die Eins woanders', () => {
    expect(isAccent(3, 3)).toBe(true);
    expect(isAccent(3, 4)).toBe(false);
  });

  it('betont nichts, wenn die Taktlänge unsinnig ist', () => {
    expect(isAccent(0, 0)).toBe(false);
  });
});

describe('beatTimeSec – die Zeitpunkte auf der Audio-Uhr', () => {
  it('legt bei 60 bpm einen Schlag je Sekunde', () => {
    expect(beatTimeSec(0, 60)).toBe(0);
    expect(beatTimeSec(3, 60)).toBe(3);
  });

  it('trifft auch spät noch exakt – aus der Zahl gerechnet, nicht aufaddiert', () => {
    expect(beatTimeSec(600, 120)).toBe(300);
  });
});

describe('countInDone – wann der Ton von selbst aufhört', () => {
  it('hört im Einzähl-Betrieb nach zwei Takten auf', () => {
    expect(countInDone(7, '4/4', 'einzaehlen')).toBe(false);
    expect(countInDone(8, '4/4', 'einzaehlen')).toBe(true);
  });

  it('richtet sich dabei nach der Taktart', () => {
    expect(countInDone(5, '3/4', 'einzaehlen')).toBe(false);
    expect(countInDone(6, '3/4', 'einzaehlen')).toBe(true);
  });

  it('hört im Dauerbetrieb NIE von selbst auf', () => {
    expect(countInDone(8, '4/4', 'dauerhaft')).toBe(false);
    expect(countInDone(10_000, '4/4', 'dauerhaft')).toBe(false);
  });
});

describe('erstesSchlagAb – in ein laufendes Raster einsteigen', () => {
  it('fängt bei null an, wenn noch nichts läuft', () => {
    expect(erstesSchlagAb(0, 120)).toBe(0);
    expect(erstesSchlagAb(-50, 120)).toBe(0);
  });

  it('nimmt den NÄCHSTEN Schlag, nie den schon vergangenen', () => {
    // 120 bpm = 500 ms je Schlag. Nach 600 ms ist Schlag 1 vorbei, der nächste ist 2.
    expect(erstesSchlagAb(600, 120)).toBe(2);
    expect(erstesSchlagAb(1400, 120)).toBe(3);
  });

  it('trifft einen Schlag genau, ohne ihn zu überspringen', () => {
    expect(erstesSchlagAb(1000, 120)).toBe(2);
  });
});

describe('einzaehlStart – Einzählen beginnt auf einer Eins', () => {
  it('rundet auf den nächsten Taktanfang auf', () => {
    // 4/4: aus Schlag 5 wird 8, aus 9 wird 12.
    expect(einzaehlStart(5, 4)).toBe(8);
    expect(einzaehlStart(9, 4)).toBe(12);
  });

  it('lässt einen Taktanfang, wo er ist', () => {
    expect(einzaehlStart(8, 4)).toBe(8);
    expect(einzaehlStart(0, 4)).toBe(0);
  });

  it('rechnet mit der echten Taktart, nicht immer mit vier', () => {
    expect(einzaehlStart(4, 3)).toBe(6);
  });
});

describe('countInDone – gezählt wird ab dem EIGENEN Anfang', () => {
  it('zählt ohne Einstieg wie bisher ab null', () => {
    // 4/4, zwei Takte = 8 Schläge.
    expect(countInDone(7, '4/4', 'einzaehlen')).toBe(false);
    expect(countInDone(8, '4/4', 'einzaehlen')).toBe(true);
  });

  it('zählt beim Einstieg mitten im Raster ab dem Startschlag', () => {
    // Bei Schlag 12 eingestiegen: fertig erst bei 20, nicht schon bei 8.
    expect(countInDone(12, '4/4', 'einzaehlen', 12)).toBe(false);
    expect(countInDone(19, '4/4', 'einzaehlen', 12)).toBe(false);
    expect(countInDone(20, '4/4', 'einzaehlen', 12)).toBe(true);
  });

  it('endet dauerhaft nie von selbst, egal wo eingestiegen wurde', () => {
    expect(countInDone(500, '4/4', 'dauerhaft', 12)).toBe(false);
  });
});
