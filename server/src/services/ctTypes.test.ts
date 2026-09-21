import { describe, expect, it } from 'vitest';
import { alsTempoZahl, arrangementTempo } from './ctTypes.js';

/**
 * **Die eine Tempo-Umrechnung** (#396, zusammengeführt im Code-Check am 21.09.2026).
 *
 * ChurchTools liefert das Tempo je nach Endpunkt als Zahl oder als Zeichenkette, gelegentlich leer.
 * Die Fälle, die vorher je nach Kopie anders ausgingen, stehen hier einzeln: `''` darf NICHT `0`
 * werden (`Number('')` ist `0`, und `0` heißt für den Puls „tempolos", #145), und Unfug darf kein
 * `NaN` ergeben – ein `NaN` wäre als `null` nach ChurchTools gegangen und hätte das Tempo für das
 * ganze Team gelöscht.
 */
describe('alsTempoZahl', () => {
  it('nimmt Zahlen wie sie sind', () => {
    expect(alsTempoZahl(120)).toBe(120);
    expect(alsTempoZahl(0)).toBe(0);
  });

  it('rechnet Zeichenketten um, auch mit Leerraum', () => {
    expect(alsTempoZahl('120')).toBe(120);
    expect(alsTempoZahl(' 96 ')).toBe(96);
  });

  it('macht aus Leerstring und Unfug `null`, nicht `0` und nicht `NaN`', () => {
    expect(alsTempoZahl('')).toBeNull();
    expect(alsTempoZahl('   ')).toBeNull();
    expect(alsTempoZahl('schnell')).toBeNull();
    expect(alsTempoZahl(Number.NaN)).toBeNull();
    expect(alsTempoZahl(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('kennt kein Tempo, wenn keines da ist', () => {
    expect(alsTempoZahl(null)).toBeNull();
    expect(alsTempoZahl(undefined)).toBeNull();
  });
});

describe('arrangementTempo', () => {
  it('bevorzugt das beschreibbare `tempo` gegenüber dem abgeleiteten `bpm`', () => {
    expect(arrangementTempo({ tempo: 118, bpm: '120' })).toBe(118);
  });

  it('fällt auf `bpm` zurück und rechnet es um', () => {
    expect(arrangementTempo({ tempo: null, bpm: '134' })).toBe(134);
    expect(arrangementTempo({ bpm: 134 })).toBe(134);
  });

  it('bleibt bei Unfug leer statt `NaN` zu liefern', () => {
    expect(arrangementTempo({ bpm: 'irgendwas' })).toBeNull();
    expect(arrangementTempo({ tempo: null, bpm: null })).toBeNull();
  });
});
