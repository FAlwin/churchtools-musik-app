import { describe, it, expect } from 'vitest';
import { MAX_BPM, MIN_BPM } from '@shared/tempo/index';
import { tempoSchema } from './setlistController.js';

/**
 * Der Wert geht nach ChurchTools und gilt dort für ALLE – deshalb wird er serverseitig geprüft und
 * nicht nur im Menü.
 *
 * **Die Grenzen werden bewusst gegen `@shared/tempo` geprüft und nicht gegen hingeschriebene
 * Zahlen.** Sonst bliebe dieser Test genau bei dem Fehler grün, für den es ihn gibt: Stünde im
 * Schema wieder `.min(20).max(300)` von Hand und jemand weitete den Bereich in `shared`, liefen
 * Client und Server auseinander – der Speichern-Knopf böte etwas an, das der Server mit 400
 * ablehnt – und ein Test mit denselben Literalen würde weiter grün melden.
 */
describe('tempoSchema – was als Tempo durchgeht', () => {
  it('nimmt die Grenzwerte selbst an', () => {
    expect(tempoSchema.parse({ tempo: MIN_BPM }).tempo).toBe(MIN_BPM);
    expect(tempoSchema.parse({ tempo: MAX_BPM }).tempo).toBe(MAX_BPM);
  });

  it('lehnt alles außerhalb ab – die Grenzen stammen aus @shared/tempo', () => {
    expect(() => tempoSchema.parse({ tempo: MIN_BPM - 1 })).toThrow();
    expect(() => tempoSchema.parse({ tempo: MAX_BPM + 1 })).toThrow();
  });

  it('lehnt Unfug ab, statt ihn nach ChurchTools zu schreiben', () => {
    for (const tempo of [0, -120, Number.NaN, Number.POSITIVE_INFINITY, 'schnell', null]) {
      expect(() => tempoSchema.parse({ tempo })).toThrow();
    }
  });

  it('lehnt Bruchzahlen ab – ChurchTools führt das Tempo ganzzahlig', () => {
    expect(() => tempoSchema.parse({ tempo: 120.5 })).toThrow();
  });

  it('nimmt die Zahl auch als Zeichenkette an – so kommt sie aus JSON-Formularen', () => {
    expect(tempoSchema.parse({ tempo: '96' }).tempo).toBe(96);
  });
});
