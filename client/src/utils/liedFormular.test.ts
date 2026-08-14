import { describe, it, expect } from 'vitest';
import type {
  LiedStammdatenAnsicht,
  SongLibraryEntry,
  SongSelectSong,
  SongSelectTreffer,
} from '@shared/types/index';
import { LIED_GRENZEN } from '@shared/types/index';
import {
  LEERES_FORMULAR,
  aenderungAus,
  auftragAus,
  formularAusLied,
  formularAusTreffer,
  formularBereit,
  hatAenderung,
  namensWarnung,
  CCLI_NUMMER_STELLEN_FUER_AUTO,
  automatischSuchen,
  notenblattPlan,
  sucheArt,
  trefferUnterzeile,
} from './liedFormular';

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

/* ════════════════════════════ Stammdaten ändern (#322, Schritt 11) ════════════════════════════ */

const IST: LiedStammdatenAnsicht = {
  songId: 7,
  name: 'Treu',
  author: 'Autor A',
  ccli: '5841527',
  copyright: '2019 Beispielverlag',
  categoryId: 0,
};

describe('formularAusLied', () => {
  it('füllt das Formular aus dem gelesenen Stand', () => {
    const f = formularAusLied(IST);
    expect(f.name).toBe('Treu');
    expect(f.author).toBe('Autor A');
    expect(f.ccli).toBe('5841527');
    expect(f.copyright).toBe('2019 Beispielverlag');
    expect(f.categoryId).toBe(0);
  });

  it('macht aus `null` ein leeres Feld', () => {
    const f = formularAusLied({ ...IST, author: null, ccli: null, copyright: null });
    expect(f.author).toBe('');
    expect(f.ccli).toBe('');
    expect(f.copyright).toBe('');
  });

  it('lässt Tonart und Arrangement-Name leer – die gehören zum Arrangement', () => {
    const f = formularAusLied(IST);
    expect(f.key).toBe('');
    expect(f.arrangementName).toBe('');
  });
});

describe('aenderungAus', () => {
  it('schickt nichts, wenn nichts geändert wurde', () => {
    expect(aenderungAus(formularAusLied(IST), IST)).toEqual({});
    expect(hatAenderung(formularAusLied(IST), IST)).toBe(false);
  });

  it('schickt nur das geänderte Feld', () => {
    const f = { ...formularAusLied(IST), name: 'Treu (neu)' };
    expect(aenderungAus(f, IST)).toEqual({ name: 'Treu (neu)' });
    expect(hatAenderung(f, IST)).toBe(true);
  });

  it('macht aus einem geleerten Feld ein `""` – die Absicht „löschen"', () => {
    // Der Server lässt das Feld dann aus dem Payload fallen; ChurchTools setzt es auf null. Ohne diese
    // Unterscheidung ließe sich ein falscher Autor nie wieder entfernen.
    const f = { ...formularAusLied(IST), author: '' };
    expect(aenderungAus(f, IST)).toEqual({ author: '' });
  });

  it('hält ein leeres Feld und ein `null` im Bestand für dasselbe', () => {
    // Sonst wäre der Speichern-Knopf bei jedem Lied ohne Autor dauerhaft aktiv.
    const ohne = { ...IST, author: null, ccli: null, copyright: null };
    expect(aenderungAus(formularAusLied(ohne), ohne)).toEqual({});
    expect(hatAenderung(formularAusLied(ohne), ohne)).toBe(false);
  });

  it('ignoriert reine Leerzeichen als Änderung', () => {
    const f = { ...formularAusLied(IST), author: '  Autor A  ' };
    expect(aenderungAus(f, IST)).toEqual({});
  });

  it('nimmt einen Kategorie-Wechsel mit – auch nach Kategorie 0', () => {
    expect(aenderungAus({ ...formularAusLied(IST), categoryId: 1 }, IST)).toEqual({
      categoryId: 1,
    });
    const ausEins = { ...IST, categoryId: 1 };
    expect(aenderungAus({ ...formularAusLied(ausEins), categoryId: 0 }, ausEins)).toEqual({
      categoryId: 0,
    });
  });

  it('schickt keine Kategorie, wenn keine gewählt ist', () => {
    // `null` heißt „nicht gewählt" – daraus darf niemals eine 0 („Aktive Songs") werden.
    const f = { ...formularAusLied(IST), categoryId: null };
    expect('categoryId' in aenderungAus(f, IST)).toBe(false);
  });
});

describe('namensWarnung beim Ändern', () => {
  it('warnt NICHT wegen des eigenen Namens', () => {
    // Ohne diese Ausnahme stünde beim Öffnen jedes Formulars „gibt es schon" – über dem Lied selbst.
    expect(namensWarnung('Treu', [lied(7, 'Treu')], 7)).toBeNull();
  });

  it('warnt weiter wegen eines FREMDEN Liedes mit dem Namen', () => {
    expect(namensWarnung('Treu', [lied(7, 'Treu'), lied(9, 'Treu')], 7)).toContain('„Treu"');
  });
});

describe('sucheArt – Titel oder CCLI-Nummer', () => {
  it('reine Ziffern sind eine Nummer', () => {
    expect(sucheArt('5841527')).toEqual({ art: 'nummer', nummer: 5841527 });
  });

  it('Leerzeichen drumherum stören nicht', () => {
    expect(sucheArt('  5841527  ')).toEqual({ art: 'nummer', nummer: 5841527 });
  });

  it('alles mit Buchstaben ist ein Titel – auch mit Zahl darin', () => {
    // „Psalm 23" ist ein Titel. Nur wenn NICHTS außer Ziffern da ist, wird abgefragt.
    expect(sucheArt('Psalm 23')).toEqual({ art: 'titel', titel: 'Psalm 23' });
    expect(sucheArt('Treu')).toEqual({ art: 'titel', titel: 'Treu' });
  });

  it('eine Zahl mit Bindestrich oder Punkt ist ein Titel', () => {
    // Sonst würde aus einer Jahresangabe oder einem Datum stillschweigend eine Nummer.
    expect(sucheArt('2019-2020').art).toBe('titel');
    expect(sucheArt('1.2.3').art).toBe('titel');
  });

  it('liefert den Titel getrimmt zurück', () => {
    expect(sucheArt('  Treu  ')).toEqual({ art: 'titel', titel: 'Treu' });
  });
});

describe('automatischSuchen – wann von selbst gesucht wird', () => {
  const MIN = 3;

  it('ein Titel ab der Mindestlänge', () => {
    expect(automatischSuchen('Tr', MIN)).toBe(false);
    expect(automatischSuchen('Tre', MIN)).toBe(true);
  });

  it('eine Nummer erst, wenn sie vollständig aussieht', () => {
    /**
     * Gemessen: Alle 46 CCLI-Nummern im Bestand haben 7 Stellen. Ohne diese Schwelle würde beim Tippen
     * von „5841527" viermal „findet CCLI kein Lied" erscheinen, bevor die Nummer fertig ist.
     */
    expect(automatischSuchen('584', MIN)).toBe(false);
    expect(automatischSuchen('584152', MIN)).toBe(false);
    expect(automatischSuchen('5841527', MIN)).toBe(true);
  });

  it('nutzt die Schwelle aus der Konstante, nicht eine eigene Zahl', () => {
    const knapp = '9'.repeat(CCLI_NUMMER_STELLEN_FUER_AUTO - 1);
    const genau = '9'.repeat(CCLI_NUMMER_STELLEN_FUER_AUTO);
    expect(automatischSuchen(knapp, MIN)).toBe(false);
    expect(automatischSuchen(genau, MIN)).toBe(true);
  });

  it('zählt Leerzeichen nicht mit', () => {
    expect(automatischSuchen('  Tre  ', MIN)).toBe(true);
    expect(automatischSuchen('   ', MIN)).toBe(false);
  });
});
