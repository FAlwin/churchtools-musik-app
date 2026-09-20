import { describe, expect, it } from 'vitest';
import type { ArrangementAnsicht } from '@shared/types/index';
import {
  LEERES_ARRANGEMENT,
  arrangementBereit,
  arrangementHinweis,
  auftragAus,
  formularAusArrangement,
  hatAenderung,
  laengeSekunden,
  laengeTeile,
  laengeText,
  unterzeile,
  type ArrangementFormular,
} from './arrangementFormular';

/**
 * Das Arrangement-Formular (#396).
 *
 * **Die beiden gefährlichen Stellen stehen hier, nicht in der Komponente:**
 *
 *  1. Die Länge – ChurchTools führt sie in **Sekunden**, der Dialog zeigt Minuten:Sekunden. Eine
 *     zweite Rechnung daneben wäre die Wiederholung des PDF-Fehlers vom 31.07.2026.
 *  2. Der Unterschied zwischen „unverändert" (`undefined`) und „leeren" (`null`). Wer ihn
 *     verwechselt, kann entweder nie ein Feld leeren – oder löscht bei jedem Speichern die Felder,
 *     die er gar nicht angefasst hat. Beides fiele erst in ChurchTools auf, für das ganze Team.
 */
const ARR: ArrangementAnsicht = {
  id: 71,
  name: 'Akustik',
  isDefault: false,
  key: 'G',
  tempo: 120,
  beat: '4/4',
  duration: 245,
  description: 'Ohne Schlagzeug',
  source: { id: 2, name: 'Unser Liederbuch', shorty: 'ULB' },
  sourceReference: '142',
  dateien: 0,
};

function formular(over: Partial<ArrangementFormular> = {}): ArrangementFormular {
  return { ...formularAusArrangement(ARR), ...over };
}

describe('Länge – Sekunden hin und zurück', () => {
  it('rechnet die gemessene Länge um: 245 Sekunden sind 4:05', () => {
    expect(laengeTeile(245)).toEqual({ min: '4', sek: '05' });
    expect(laengeText(245)).toBe('4:05');
    expect(laengeSekunden('4', '05')).toBe(245);
  });

  it('kommt hin und zurück beim selben Wert heraus', () => {
    for (const sek of [1, 59, 60, 61, 245, 3599, 3600]) {
      const { min, sek: s } = laengeTeile(sek);
      expect(laengeSekunden(min, s)).toBe(sek);
    }
  });

  it('macht aus „keine Länge" zwei leere Felder – nicht 0:00', () => {
    expect(laengeTeile(null)).toEqual({ min: '', sek: '' });
    expect(laengeText(null)).toBe('');
  });

  it('macht aus zwei leeren Feldern `null` – nicht 0 Sekunden', () => {
    expect(laengeSekunden('', '')).toBeNull();
    expect(laengeSekunden('0', '0')).toBeNull();
  });

  it('verträgt nur Sekunden ohne Minuten', () => {
    expect(laengeSekunden('', '45')).toBe(45);
  });

  it('gibt bei Unsinn `null` statt NaN', () => {
    expect(laengeSekunden('abc', '')).toBeNull();
    expect(laengeSekunden('-3', '')).toBeNull();
  });
});

describe('formularAusArrangement', () => {
  it('füllt alle acht Felder', () => {
    expect(formularAusArrangement(ARR)).toEqual({
      name: 'Akustik',
      key: 'G',
      tempo: '120',
      beat: '4/4',
      laengeMin: '4',
      laengeSek: '05',
      description: 'Ohne Schlagzeug',
      sourceId: 2,
      sourceReference: '142',
    });
  });

  it('macht aus `null` ein leeres Feld, nicht den Text „null"', () => {
    const leer = formularAusArrangement({
      ...ARR,
      key: null,
      tempo: null,
      beat: null,
      duration: null,
      description: null,
      source: null,
      sourceReference: null,
    });
    expect(leer).toEqual({ ...LEERES_ARRANGEMENT, name: 'Akustik' });
  });
});

describe('arrangementBereit und der Hinweis', () => {
  it('braucht einen Namen', () => {
    expect(arrangementBereit(LEERES_ARRANGEMENT)).toBe(false);
    expect(arrangementBereit({ ...LEERES_ARRANGEMENT, name: '  ' })).toBe(false);
    expect(arrangementBereit({ ...LEERES_ARRANGEMENT, name: 'Akustik' })).toBe(true);
  });

  /**
   * ChurchTools nimmt eine Liednummer ohne Quelle an und **wirft sie weg** (gemessen). Der Hinweis
   * steht vor dem Speichern, damit niemand erst hinterher merkt, dass seine Eingabe verschwunden ist.
   */
  it('warnt vor einer Liednummer ohne Quelle', () => {
    expect(arrangementHinweis({ ...LEERES_ARRANGEMENT, sourceReference: '142' })).toMatch(
      /nur zusammen mit einer Quelle/,
    );
  });

  it('schweigt, wenn eine Quelle gewählt ist', () => {
    expect(
      arrangementHinweis({ ...LEERES_ARRANGEMENT, sourceId: 2, sourceReference: '142' }),
    ).toBeNull();
  });
});

describe('auftragAus – beim Anlegen', () => {
  it('nimmt nur mit, was ausgefüllt ist', () => {
    expect(auftragAus({ ...LEERES_ARRANGEMENT, name: 'Akustik', key: 'G' }, null)).toEqual({
      name: 'Akustik',
      key: 'G',
    });
  });

  it('lässt eine Liednummer ohne Quelle weg – sie hätte keinen Halt', () => {
    const auftrag = auftragAus(
      { ...LEERES_ARRANGEMENT, name: 'Akustik', sourceReference: '142' },
      null,
    );
    expect('sourceReference' in auftrag).toBe(false);
    expect('sourceId' in auftrag).toBe(false);
  });

  it('rechnet die Länge in Sekunden um', () => {
    const auftrag = auftragAus(
      { ...LEERES_ARRANGEMENT, name: 'Akustik', laengeMin: '4', laengeSek: '05' },
      null,
    );
    expect(auftrag.duration).toBe(245);
  });
});

describe('auftragAus – beim Ändern schickt NUR das Geänderte', () => {
  it('schickt bei unverändertem Formular nur den Namen', () => {
    expect(auftragAus(formular(), ARR)).toEqual({ name: 'Akustik' });
  });

  it('schickt ein geändertes Feld', () => {
    expect(auftragAus(formular({ key: 'A' }), ARR)).toEqual({ name: 'Akustik', key: 'A' });
  });

  it('schickt `null`, wenn ein Feld geleert wird – NICHT einfach nichts', () => {
    // Der Unterschied ist der Kern dieser Datei: `undefined` hieße „lass es, wie es war".
    expect(auftragAus(formular({ beat: '' }), ARR).beat).toBeNull();
    expect(auftragAus(formular({ tempo: '' }), ARR).tempo).toBeNull();
    expect(auftragAus(formular({ laengeMin: '', laengeSek: '' }), ARR).duration).toBeNull();
  });

  it('nimmt die Liednummer mit, wenn nur die Quelle wechselt – sie gehört zu ihr', () => {
    const auftrag = auftragAus(formular({ sourceId: 5 }), ARR);
    expect(auftrag.sourceId).toBe(5);
    expect(auftrag.sourceReference).toBe('142');
  });

  it('nimmt die Nummer mit weg, wenn die Quelle entfernt wird', () => {
    const auftrag = auftragAus(formular({ sourceId: null, sourceReference: '' }), ARR);
    expect(auftrag.sourceId).toBeNull();
    expect(auftrag.sourceReference).toBeNull();
  });

  it('trimmt, was der Nutzer eintippt', () => {
    expect(auftragAus(formular({ name: '  Akustik  ' }), ARR)).toEqual({ name: 'Akustik' });
  });
});

describe('hatAenderung', () => {
  it('erkennt „nichts geändert"', () => {
    expect(hatAenderung(formular(), ARR)).toBe(false);
  });

  it('erkennt jede einzelne Änderung', () => {
    expect(hatAenderung(formular({ name: 'Anders' }), ARR)).toBe(true);
    expect(hatAenderung(formular({ key: 'A' }), ARR)).toBe(true);
    expect(hatAenderung(formular({ tempo: '96' }), ARR)).toBe(true);
    expect(hatAenderung(formular({ beat: '3/4' }), ARR)).toBe(true);
    expect(hatAenderung(formular({ laengeSek: '10' }), ARR)).toBe(true);
    expect(hatAenderung(formular({ description: 'Neu' }), ARR)).toBe(true);
    expect(hatAenderung(formular({ sourceId: null, sourceReference: '' }), ARR)).toBe(true);
    expect(hatAenderung(formular({ sourceReference: '143' }), ARR)).toBe(true);
  });
});

describe('unterzeile – was in der Liste unter dem Namen steht', () => {
  it('nennt Tonart, Tempo, Takt, Länge und Quelle mit Nummer', () => {
    expect(unterzeile(ARR)).toBe('G · 120 bpm · 4/4 · 4:05 · ULB 142');
  });

  it('lässt weg, was nicht gesetzt ist – kein „· ·"', () => {
    expect(
      unterzeile({
        ...ARR,
        tempo: null,
        beat: null,
        duration: null,
        source: null,
        sourceReference: null,
      }),
    ).toBe('G');
  });

  it('bleibt leer, wenn gar nichts gesetzt ist', () => {
    expect(
      unterzeile({
        ...ARR,
        key: null,
        tempo: null,
        beat: null,
        duration: null,
        source: null,
        sourceReference: null,
      }),
    ).toBe('');
  });

  it('nimmt den vollen Namen, wenn die Quelle kein Kürzel hat', () => {
    expect(
      unterzeile({
        ...ARR,
        key: null,
        tempo: null,
        beat: null,
        duration: null,
        source: { id: 2, name: 'Feiert Jesus', shorty: '' },
      }),
    ).toBe('Feiert Jesus 142');
  });
});
