import { describe, expect, it } from 'vitest';
import {
  COUNT_IN_BARS,
  DEFAULT_BEATS_PER_BAR,
  autoZaehlweise,
  beatTimeSec,
  beatsPerBar,
  countInBeats,
  countInDone,
  einzaehlStart,
  erstesSchlagAb,
  gezaehlteSchlaegeProTakt,
  gezaehltesTempo,
  isAccent,
  moeglicheZaehlweisen,
  taktRaster,
  taktartTeile,
  wirksameZaehlweise,
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
    expect(countInBeats(4)).toBe(2 * 4);
    expect(countInBeats(3)).toBe(2 * 3);
    expect(COUNT_IN_BARS).toBe(2);
  });

  it('nimmt auch ohne Angabe zwei Vierertakte', () => {
    expect(countInBeats(4)).toBe(8);
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
    expect(countInDone(7, 4, 'einzaehlen')).toBe(false);
    expect(countInDone(8, 4, 'einzaehlen')).toBe(true);
  });

  it('richtet sich dabei nach der Taktlänge', () => {
    expect(countInDone(5, 3, 'einzaehlen')).toBe(false);
    expect(countInDone(6, 3, 'einzaehlen')).toBe(true);
  });

  it('hört im Dauerbetrieb NIE von selbst auf', () => {
    expect(countInDone(8, 4, 'dauerhaft')).toBe(false);
    expect(countInDone(10_000, 4, 'dauerhaft')).toBe(false);
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
    expect(countInDone(7, 4, 'einzaehlen')).toBe(false);
    expect(countInDone(8, 4, 'einzaehlen')).toBe(true);
  });

  it('zählt beim Einstieg mitten im Raster ab dem Startschlag', () => {
    // Bei Schlag 12 eingestiegen: fertig erst bei 20, nicht schon bei 8.
    expect(countInDone(12, 4, 'einzaehlen', 12)).toBe(false);
    expect(countInDone(19, 4, 'einzaehlen', 12)).toBe(false);
    expect(countInDone(20, 4, 'einzaehlen', 12)).toBe(true);
  });

  it('endet dauerhaft nie von selbst, egal wo eingestiegen wurde', () => {
    expect(countInDone(500, 4, 'dauerhaft', 12)).toBe(false);
  });
});

describe('autoZaehlweise – Vorschlag aus der Taktart', () => {
  it('schlägt bei zusammengesetzten Achteltaktarten Dreiergruppen vor', () => {
    for (const t of ['6/8', '9/8', '12/8']) expect(autoZaehlweise(t)).toBe(3);
  });

  it('lässt alles andere bei Einzelschlägen', () => {
    for (const t of ['4/4', '3/4', '2/4', '5/4', '7/8', '3/8']) expect(autoZaehlweise(t)).toBe(1);
  });

  it('entscheidet NICHT nach dem Tempo – dafür gibt es den Umschalter', () => {
    // Sonst wuerfe ein Verstellen des Tempos plötzlich die Zählweise um. Die Funktion kennt das
    // Tempo gar nicht; dieser Test haelt das fest.
    expect(autoZaehlweise('4/4')).toBe(1);
  });

  it('kommt ohne brauchbare Angabe mit Einzelschlägen aus', () => {
    for (const t of [null, undefined, '', 'Unsinn']) expect(autoZaehlweise(t)).toBe(1);
  });
});

describe('moeglicheZaehlweisen – nur was einen Takt ergibt', () => {
  it('bietet im Viervierteltakt Einzeln und Zweier, aber nicht Dreier', () => {
    expect(moeglicheZaehlweisen('4/4')).toEqual([1, 2]);
  });

  it('bietet im Dreivierteltakt Einzeln und Dreier, aber nicht Zweier', () => {
    expect(moeglicheZaehlweisen('3/4')).toEqual([1, 3]);
  });

  it('bietet im 6/8 alle drei', () => {
    expect(moeglicheZaehlweisen('6/8')).toEqual([1, 2, 3]);
  });

  it('bietet bei ungerader Taktart nur Einzelschläge', () => {
    expect(moeglicheZaehlweisen('5/4')).toEqual([1]);
    expect(moeglicheZaehlweisen('7/8')).toEqual([1]);
  });
});

describe('gezaehlteSchlaegeProTakt – die Länge des Takts', () => {
  it('teilt die Schläge durch die Zählweise', () => {
    expect(gezaehlteSchlaegeProTakt('6/8', 3)).toBe(2);
    expect(gezaehlteSchlaegeProTakt('4/4', 2)).toBe(2);
    expect(gezaehlteSchlaegeProTakt('3/4', 3)).toBe(1);
  });

  it('lässt den Grundtakt stehen, wenn die Zählweise nicht aufgeht', () => {
    // Aus 4/4 in Dreiern folgte 1⅓ – lieber der ungeteilte Takt als eine Eins an falscher Stelle.
    expect(gezaehlteSchlaegeProTakt('4/4', 3)).toBe(4);
    expect(gezaehlteSchlaegeProTakt('4/4', 0)).toBe(4);
  });
});

describe('gezaehltesTempo – die Zahl bedeutet immer Grundschläge', () => {
  it('teilt das Grundtempo durch die Zählweise', () => {
    expect(gezaehltesTempo(120, 3)).toBe(40);
    expect(gezaehltesTempo(160, 2)).toBe(80);
  });

  it('lässt es bei Einzelschlägen unverändert', () => {
    expect(gezaehltesTempo(120, 1)).toBe(120);
  });

  it('kommt mit fehlendem Tempo zurecht', () => {
    expect(gezaehltesTempo(null, 3)).toBeNull();
  });
});

describe('taktartTeile – EINE Zerlegung für alle', () => {
  it('liefert Zähler und Nenner', () => {
    expect(taktartTeile('6/8')).toEqual({ zaehler: 6, nenner: 8 });
    expect(taktartTeile(' 3 / 4 ')).toEqual({ zaehler: 3, nenner: 4 });
  });

  it('lehnt Unbrauchbares ab, statt zu raten', () => {
    for (const t of [null, undefined, '', 'C', '4', '99/4']) expect(taktartTeile(t)).toBeNull();
  });

  it('ist die einzige Quelle für beatsPerBar – beide müssen zusammenpassen', () => {
    // Sonst stünde die Zerlegung ein zweites Mal im Code und könnte abweichen.
    for (const t of ['4/4', '3/4', '6/8', '12/8', 'Unsinn', null]) {
      expect(beatsPerBar(t)).toBe(taktartTeile(t)?.zaehler ?? 4);
    }
  });
});

describe('wirksameZaehlweise – eine Regel, nicht zwei', () => {
  it('nimmt die gewählte, wenn eine da ist', () => {
    expect(wirksameZaehlweise(2, '6/8')).toBe(2);
    expect(wirksameZaehlweise(1, '6/8')).toBe(1);
  });

  it('fällt sonst auf den Vorschlag aus der Taktart zurück', () => {
    expect(wirksameZaehlweise(null, '6/8')).toBe(3);
    expect(wirksameZaehlweise(null, '4/4')).toBe(1);
  });

  it('ist genau `autoZaehlweise`, wenn nichts gewählt ist – kein zweiter Vorschlag', () => {
    for (const t of ['4/4', '3/4', '6/8', '9/8', '12/8', '7/8', null]) {
      expect(wirksameZaehlweise(null, t)).toBe(autoZaehlweise(t));
    }
  });
});

describe('taktRaster – die drei Werte entstehen an EINER Stelle', () => {
  it('leitet bei 6/8 ohne Wahl Dreiergruppen ab', () => {
    // 120 Achtel, in Dreiergruppen: 40 gezählte Schläge, zwei je Takt.
    expect(taktRaster(120, '6/8', null)).toEqual({
      zaehlweise: 3,
      klickTempo: 40,
      schlaegeProTakt: 2,
    });
  });

  it('folgt der Wahl, auch gegen den Vorschlag', () => {
    expect(taktRaster(120, '6/8', 1)).toEqual({
      zaehlweise: 1,
      klickTempo: 120,
      schlaegeProTakt: 6,
    });
  });

  it('zählt schnelles 4/4 auf Wunsch in Halben', () => {
    expect(taktRaster(160, '4/4', 2)).toEqual({
      zaehlweise: 2,
      klickTempo: 80,
      schlaegeProTakt: 2,
    });
  });

  it('lässt 4/4 ohne Wahl unverändert', () => {
    expect(taktRaster(120, '4/4', null)).toEqual({
      zaehlweise: 1,
      klickTempo: 120,
      schlaegeProTakt: 4,
    });
  });

  it('kommt ohne Tempo und ohne Taktart zurecht', () => {
    expect(taktRaster(null, null, null)).toEqual({
      zaehlweise: 1,
      klickTempo: null,
      schlaegeProTakt: 4,
    });
  });

  it('lässt eine unmögliche Zählweise nicht durchschlagen', () => {
    // 4/4 in Dreiern gibt es nicht – der Takt bleibt ungeteilt, statt bei 1⅓ zu landen.
    expect(taktRaster(120, '4/4', 3).schlaegeProTakt).toBe(4);
  });
});
