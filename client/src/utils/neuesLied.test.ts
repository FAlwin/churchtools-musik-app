import { describe, it, expect } from 'vitest';
import type { SongLibraryEntry, SongSelectSong, SongSelectTreffer } from '@shared/types/index';
import { LIED_GRENZEN } from '@shared/types/index';
import {
  LEERES_FORMULAR,
  auftragAus,
  formularAusTreffer,
  formularBereit,
  namensWarnung,
  notenblattPlan,
  trefferUnterzeile,
} from './neuesLied';

/**
 * Die Regeln des Formulars „Neues Lied" (#322, Schritt 10b).
 *
 * **Die Grenzen kommen aus `LIED_GRENZEN`, nicht als Zahl im Test.** Verschiebt ChurchTools die
 * Mindestlänge, soll der Test mitwandern – ein hart geschriebenes `2` würde die Regel gegen ihren
 * eigenen Erzeuger prüfen und wäre bei genau der Änderung grün, die er bewachen soll.
 */

const TREFFER: SongSelectTreffer = {
  songNumber: 5841527,
  title: 'Treu',
  authors: ['Autor A', 'Autor B'],
  defaultKey: 'E',
  isPublicDomain: false,
  hasLyrics: true,
  hasChordPro: true,
  hasChordSheet: true,
};

const VOLL: SongSelectSong = { ...TREFFER, copyright: '2019 Beispielverlag' };

const lied = (songId: number, name: string): SongLibraryEntry => ({
  songId,
  name,
  author: null,
  key: null,
  arrangementId: songId * 10,
});

describe('formularAusTreffer', () => {
  it('übernimmt Titel, Autoren, Nummer und Tonart', () => {
    const f = formularAusTreffer(TREFFER);
    expect(f.name).toBe('Treu');
    expect(f.author).toBe('Autor A, Autor B');
    expect(f.ccli).toBe('5841527');
    expect(f.key).toBe('E');
  });

  it('lässt die gewählte Kategorie stehen – sie wird NIE vorbelegt', () => {
    // Entscheidung Alwin (13.08.2026): Pflichtfeld ohne Vorschlag. Wer eine Kategorie gewählt hat und
    // dann einen anderen Treffer antippt, soll seine Wahl behalten.
    const vorher = { ...LEERES_FORMULAR, categoryId: 1 };
    expect(formularAusTreffer(TREFFER, vorher).categoryId).toBe(1);
    expect(formularAusTreffer(TREFFER).categoryId).toBeNull();
  });

  it('holt das Copyright nur aus der Einzelabfrage, nicht aus der Trefferliste', () => {
    // Die Liste von CCLI enthält kein Copyright. Ein Platzhalter wäre eine Behauptung über Rechte.
    expect(formularAusTreffer(TREFFER).copyright).toBe('');
    expect(formularAusTreffer(VOLL).copyright).toBe('2019 Beispielverlag');
  });

  it('macht aus einem fehlenden Copyright einen leeren Text, nicht „null"', () => {
    expect(formularAusTreffer({ ...VOLL, copyright: null }).copyright).toBe('');
  });
});

describe('formularBereit', () => {
  const name = 'x'.repeat(LIED_GRENZEN.name.min);

  it('braucht Name UND Kategorie', () => {
    expect(formularBereit({ ...LEERES_FORMULAR, name, categoryId: 3 })).toBe(true);
    expect(formularBereit({ ...LEERES_FORMULAR, name, categoryId: null })).toBe(false);
    expect(formularBereit({ ...LEERES_FORMULAR, name: '', categoryId: 3 })).toBe(false);
  });

  it('Kategorie 0 ist eine echte Wahl', () => {
    // „Aktive Songs" hat die ID 0 – dort liegen bei der ECG alle 49 Lieder. Ein Falsy-Test auf die
    // Kategorie hätte ausgerechnet die häufigste unmöglich gemacht.
    expect(formularBereit({ ...LEERES_FORMULAR, name, categoryId: 0 })).toBe(true);
  });

  it('zu kurzer Name genügt nicht', () => {
    const zuKurz = 'x'.repeat(LIED_GRENZEN.name.min - 1);
    expect(formularBereit({ ...LEERES_FORMULAR, name: zuKurz, categoryId: 0 })).toBe(false);
  });

  it('Leerzeichen sind kein Name', () => {
    expect(formularBereit({ ...LEERES_FORMULAR, name: '     ', categoryId: 0 })).toBe(false);
  });
});

describe('namensWarnung', () => {
  const bestand = [lied(1, 'Treu'), lied(2, 'Wo ich auch stehe')];

  it('warnt bei gleichem Namen – ohne auf Groß-/Kleinschreibung oder Leerzeichen zu bestehen', () => {
    expect(namensWarnung('treu ', bestand)).toContain('„Treu"');
    expect(namensWarnung('TREU', bestand)).toBeTruthy();
  });

  it('schweigt bei einem neuen Namen', () => {
    expect(namensWarnung('Ganz neues Lied', bestand)).toBeNull();
  });

  it('nennt die Anzahl, wenn es mehrere gibt', () => {
    const doppelt = [...bestand, lied(3, 'Treu')];
    expect(namensWarnung('Treu', doppelt)).toContain('2 Lieder');
  });

  it('warnt nicht bei einem Namen, der noch zu kurz zum Vergleichen ist', () => {
    expect(namensWarnung('T', [lied(1, 'T')])).toBeNull();
  });

  it('sagt ausdrücklich, dass Anlegen trotzdem geht', () => {
    // Blockiert wird nur die gleiche CCLI-Nummer (Server). Ein Warnhinweis, der wie ein Riegel klingt,
    // würde die Entscheidung von Alwin ins Gegenteil verkehren.
    expect(namensWarnung('Treu', bestand)).toContain('trotzdem');
  });
});

describe('auftragAus', () => {
  it('lässt leere Felder weg, statt sie als "" zu senden', () => {
    // Grund steht in `createSong`: ChurchTools soll seine Vorgaben behalten, nicht mit Leerstrings
    // überschrieben werden.
    const auftrag = auftragAus({ ...LEERES_FORMULAR, name: ' Treu ' }, 0);
    expect(auftrag).toEqual({ name: 'Treu', categoryId: 0 });
    expect('author' in auftrag).toBe(false);
    expect('key' in auftrag).toBe(false);
    expect('eventId' in auftrag).toBe(false);
  });

  it('nimmt die gefüllten Felder getrimmt mit', () => {
    const auftrag = auftragAus(
      {
        name: 'Treu',
        categoryId: 0,
        author: ' Autor A ',
        ccli: ' 5841527 ',
        copyright: ' 2019 ',
        key: ' E ',
        arrangementName: ' Akustik ',
      },
      1,
      42,
    );
    expect(auftrag).toEqual({
      name: 'Treu',
      categoryId: 1,
      author: 'Autor A',
      ccli: '5841527',
      copyright: '2019',
      key: 'E',
      arrangementName: 'Akustik',
      eventId: 42,
    });
  });

  it('nimmt die übergebene Kategorie, nicht die im Formular', () => {
    // Die Komponente übergibt sie ausdrücklich, weil `formularBereit` vorher belegt hat, dass sie
    // gewählt ist. Ein `?? 0` in der Funktion wäre stillschweigend „Aktive Songs" gewesen.
    const auftrag = auftragAus({ ...LEERES_FORMULAR, name: 'Treu', categoryId: null }, 7);
    expect(auftrag.categoryId).toBe(7);
  });
});

describe('notenblattPlan', () => {
  const mitNummer = { ...LEERES_FORMULAR, name: 'Treu', ccli: '5841527' };

  it('holt das Notenblatt zur CCLI-Nummer', () => {
    expect(notenblattPlan(mitNummer, TREFFER, true)).toEqual({ songNumber: 5841527 });
  });

  it('holt nichts ohne SongSelect-Lizenz', () => {
    expect(notenblattPlan(mitNummer, TREFFER, false)).toBeNull();
  });

  it('holt nichts ohne CCLI-Nummer', () => {
    expect(notenblattPlan(LEERES_FORMULAR, null, true)).toBeNull();
  });

  it('sagt es, wenn CCLI für dieses Lied keine Akkorde hat – statt sicher zu scheitern', () => {
    const plan = notenblattPlan(mitNummer, { ...TREFFER, hasChordPro: false }, true);
    expect(plan).not.toBeNull();
    expect(plan).toHaveProperty('grund');
    if (plan && 'grund' in plan) expect(plan.grund).toContain('PDF');
  });

  it('nennt bei ganz fehlenden Akkorden keinen PDF-Weg', () => {
    const plan = notenblattPlan(
      mitNummer,
      { ...TREFFER, hasChordPro: false, hasChordSheet: false },
      true,
    );
    if (plan && 'grund' in plan) expect(plan.grund).not.toContain('PDF');
    else expect.unreachable('Es muss ein Grund genannt werden.');
  });

  it('versucht es bei einer selbst eingetippten Nummer', () => {
    // Ohne Treffer weiß niemand, welche Formate es gibt – ein Versuch kostet nur einen Hinweis.
    expect(notenblattPlan(mitNummer, null, true)).toEqual({ songNumber: 5841527 });
  });

  it('wendet die Format-Auskunft NICHT auf eine andere Nummer an', () => {
    // Der Treffer wurde übernommen, die Nummer danach von Hand geändert: Was CCLI über das eine Lied
    // weiß, sagt nichts über das andere.
    const andere = { ...mitNummer, ccli: '999' };
    expect(notenblattPlan(andere, { ...TREFFER, hasChordPro: false }, true)).toEqual({
      songNumber: 999,
    });
  });

  it('hält eine unbrauchbare Nummer für keine Nummer', () => {
    expect(notenblattPlan({ ...mitNummer, ccli: 'abc' }, null, true)).toBeNull();
    expect(notenblattPlan({ ...mitNummer, ccli: '0' }, null, true)).toBeNull();
    expect(notenblattPlan({ ...mitNummer, ccli: '-3' }, null, true)).toBeNull();
  });
});

describe('trefferUnterzeile', () => {
  it('nennt Autoren und Nummer – die Merkmale, die unscharfe Treffer unterscheidbar machen', () => {
    expect(trefferUnterzeile(TREFFER)).toBe('Autor A, Autor B · Nr. 5841527 · Akkorde');
  });

  it('sagt, wenn es nur ein PDF oder nur Text gibt', () => {
    expect(trefferUnterzeile({ ...TREFFER, hasChordPro: false })).toContain('nur Notenblatt (PDF)');
    expect(trefferUnterzeile({ ...TREFFER, hasChordPro: false, hasChordSheet: false })).toContain(
      'nur Text',
    );
  });

  it('kommt ohne Autoren aus', () => {
    expect(trefferUnterzeile({ ...TREFFER, authors: [] })).toBe('Nr. 5841527 · Akkorde');
  });

  it('nennt gemeinfrei', () => {
    expect(trefferUnterzeile({ ...TREFFER, isPublicDomain: true })).toContain('gemeinfrei');
  });
});
