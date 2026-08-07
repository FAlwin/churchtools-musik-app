import { describe, expect, it } from 'vitest';
import {
  COUNT_IN_BARS,
  DEFAULT_BEATS_PER_BAR,
  beatTimeSec,
  beatsPerBar,
  countInBeats,
  countInDone,
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
