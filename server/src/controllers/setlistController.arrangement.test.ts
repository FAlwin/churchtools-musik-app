import { describe, expect, it } from 'vitest';
import type { ArrangementAuftrag } from '@shared/types/index';
import { arrangementAendernSchema } from './setlistController.js';

/**
 * **Die Zod-Form und der geteilte Typ müssen dieselben acht Felder kennen.**
 *
 * Fehlt dem Schema ein Feld, das der Typ hat, schneidet Zod es beim Ändern **stillschweigend weg**:
 * Der Nutzer speichert, der Server meldet Erfolg, das Feld bleibt unverändert. Genau dieser Fehler
 * hat schon einmal Anmerkungen gekostet (#115).
 *
 * Der Trick ist `Required<ArrangementAuftrag>`: Kommt ein Feld zum Typ hinzu, **kompiliert dieser
 * Test nicht mehr**, bis es hier steht – und dann fällt er um, solange das Schema es nicht kennt.
 * Ein Compile-Wächter in der Bauart der Anmerkungen taugt hier nicht, weil alle Felder optional sind
 * (am 21.09.2026 ausprobiert: ein entferntes `beat` fiel ihm nicht auf).
 */
describe('arrangementAendernSchema gegen ArrangementAuftrag', () => {
  it('lässt jedes Feld des geteilten Typs durch – keines fällt still heraus', () => {
    const voll: Required<ArrangementAuftrag> = {
      name: 'Akustik',
      key: 'G',
      tempo: 120,
      beat: '4/4',
      duration: 245,
      description: 'ohne Schlagzeug',
      sourceId: 3,
      sourceReference: 'A12',
    };

    const durch = arrangementAendernSchema.parse(voll);
    expect(Object.keys(durch).sort()).toEqual(Object.keys(voll).sort());
  });

  it('lehnt einen leeren Auftrag ab, statt umsonst nach ChurchTools zu schreiben', () => {
    expect(() => arrangementAendernSchema.parse({})).toThrow();
  });
});
