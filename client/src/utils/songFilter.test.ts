import { describe, it, expect } from 'vitest';
import type { SongLibraryEntry } from '@shared/types/index';
import type { SongUsageMap } from '../services/churchtoolsApi';
import { filterSongs, liedAnzahl, statLabel, type SongFilterOpts } from './songFilter';

const SONGS: SongLibraryEntry[] = [
  { songId: 1, name: 'Anker', author: 'Autor X', ccli: '5841527', key: 'C', arrangementId: 11 },
  { songId: 2, name: 'Berg', author: 'Autor Y', ccli: null, key: 'D', arrangementId: 22 },
  { songId: 3, name: 'Cedar', author: null, ccli: '7654321', key: null, arrangementId: 33 },
];

// Termine absteigend (neuester zuerst), wie vom Server geliefert.
const USAGE: SongUsageMap = {
  '1': { dates: ['2026-06-01', '2026-01-10'] },
  '2': { dates: ['2026-07-01', '2026-05-01', '2026-04-01'] },
  // Song 3 wurde nie gespielt (kein Eintrag).
};

const opts = (o: Partial<SongFilterOpts>): SongFilterOpts => ({
  query: '',
  sort: 'name',
  from: '',
  to: '',
  showStats: true,
  ...o,
});

const names = (list: SongLibraryEntry[]) => list.map((s) => s.name);

describe('filterSongs', () => {
  it('A–Z zeigt alle Lieder alphabetisch und ignoriert den Zeitraum', () => {
    const r = filterSongs(
      SONGS,
      USAGE,
      opts({ sort: 'name', from: '2026-06-01', to: '2026-06-30' }),
    );
    expect(names(r.list)).toEqual(['Anker', 'Berg', 'Cedar']);
    expect(r.statMode).toBe(false);
  });

  it('Häufigkeit: nur im Zeitraum gespielte Lieder, nach Anzahl absteigend', () => {
    const r = filterSongs(SONGS, USAGE, opts({ sort: 'count', from: '2026-05-01' }));
    expect(names(r.list)).toEqual(['Berg', 'Anker']); // Berg 2×, Anker 1× ab 2026-05-01
    expect(r.list.find((s) => s.name === 'Cedar')).toBeUndefined(); // nie gespielt → raus
    expect(r.stats.get(2)?.count).toBe(2);
    expect(r.stats.get(1)?.count).toBe(1);
    expect(r.statMode).toBe(true);
  });

  it('Zuletzt: sortiert nach jüngstem Spieldatum, ungespielte fallen raus', () => {
    const r = filterSongs(SONGS, USAGE, opts({ sort: 'recent' }));
    expect(names(r.list)).toEqual(['Berg', 'Anker']); // Berg zuletzt 2026-07-01, Anker 2026-06-01
    expect(r.stats.get(2)?.last).toBe('2026-07-01');
    expect(r.stats.get(1)?.last).toBe('2026-06-01');
  });

  it('leerer Zeitraum („Alle") berücksichtigt alle Termine', () => {
    const r = filterSongs(SONGS, USAGE, opts({ sort: 'count' }));
    expect(r.stats.get(1)?.count).toBe(2); // beide Termine von Song 1
    expect(r.stats.get(2)?.count).toBe(3);
  });

  it('Suche filtert nach Name und Autor', () => {
    expect(names(filterSongs(SONGS, USAGE, opts({ query: 'berg' })).list)).toEqual(['Berg']);
    expect(names(filterSongs(SONGS, USAGE, opts({ query: 'autor x' })).list)).toEqual(['Anker']);
  });

  /**
   * **Titel-Treffer zuerst** (Wunsch Alwin, 13.08.2026).
   *
   * Gesucht wird in Titel und Autor. Vorher stand die Liste rein alphabetisch – „Zenit" mit dem
   * gesuchten Wort im TITEL landete hinter „Anker", das es nur im Autor trug. Wer ein Wort eintippt,
   * meint fast immer den Titel.
   */
  describe('Titel-Treffer stehen vor Autor-Treffern', () => {
    const GEMISCHT: SongLibraryEntry[] = [
      // Alphabetisch zuerst, aber „gnade" steht nur im Autor.
      { songId: 1, name: 'Anker', author: 'Peter Gnade', ccli: null, key: 'C', arrangementId: 11 },
      // Alphabetisch zuletzt, hat „Gnade" aber im Titel.
      {
        songId: 2,
        name: 'Zenit der Gnade',
        author: 'Autor Y',
        ccli: null,
        key: 'D',
        arrangementId: 22,
      },
      {
        songId: 3,
        name: 'Gnade genügt',
        author: 'Autor Z',
        ccli: null,
        key: 'E',
        arrangementId: 33,
      },
    ];

    it('A–Z: erst die Titel-Treffer (alphabetisch), dann die Autor-Treffer', () => {
      const r = filterSongs(GEMISCHT, undefined, opts({ query: 'gnade', showStats: false }));
      expect(names(r.list)).toEqual(['Gnade genügt', 'Zenit der Gnade', 'Anker']);
    });

    it('ohne Suche bleibt es reine Alphabetik', () => {
      const r = filterSongs(GEMISCHT, undefined, opts({ query: '', showStats: false }));
      expect(names(r.list)).toEqual(['Anker', 'Gnade genügt', 'Zenit der Gnade']);
    });

    it('bei Häufigkeit gewinnen weiter die ZAHLEN – sonst wäre der Umschalter wirkungslos', () => {
      // „Anker" hat das Wort nur im Autor, wurde aber öfter gespielt: Es bleibt vorn.
      const usage: SongUsageMap = {
        '1': { dates: ['2026-06-01', '2026-05-01', '2026-04-01'] },
        '2': { dates: ['2026-06-02'] },
        '3': { dates: ['2026-06-03'] },
      };
      const r = filterSongs(GEMISCHT, usage, opts({ query: 'gnade', sort: 'count' }));
      expect(names(r.list)[0]).toBe('Anker');
    });

    it('bei gleicher Häufigkeit entscheidet die Trefferart – dann erst der Name', () => {
      const usage: SongUsageMap = {
        '1': { dates: ['2026-06-01'] },
        '2': { dates: ['2026-06-01'] },
        '3': { dates: ['2026-06-01'] },
      };
      const r = filterSongs(GEMISCHT, usage, opts({ query: 'gnade', sort: 'count' }));
      expect(names(r.list)).toEqual(['Gnade genügt', 'Zenit der Gnade', 'Anker']);
    });

    it('Groß-/Kleinschreibung ändert die Einordnung nicht', () => {
      const r = filterSongs(GEMISCHT, undefined, opts({ query: 'GNADE', showStats: false }));
      expect(names(r.list)).toEqual(['Gnade genügt', 'Zenit der Gnade', 'Anker']);
    });
  });

  it('ohne Statistik-Recht bleibt es reines A–Z (kein statMode, alle Lieder)', () => {
    const r = filterSongs(SONGS, USAGE, opts({ sort: 'count', showStats: false }));
    expect(r.statMode).toBe(false);
    expect(r.list.length).toBe(3);
  });
});

/**
 * #300: Eine FEHLENDE Statistik darf nicht als „0× gespielt" erscheinen.
 *
 * Wenn ChurchTools uns drosselt, liefert der Server keine Zahlen. Vorher hätte die Liederliste dann
 * bei jedem Lied „0× gespielt" behauptet – eine falsche Aussage über die Gemeinde-Historie – und bei
 * Sortierung nach Häufigkeit/Zuletzt **alle** Lieder herausgefiltert („In diesem Zeitraum wurde kein
 * Lied gespielt."), obwohl wir es nur nicht wissen. Fehlende Zahlen sind nicht die Zahl 0.
 */
describe('statLabel – fehlende Zahlen sind nicht die Zahl 0 (#300)', () => {
  const stat = { count: 3, last: '2026-07-05' };

  it('Fehler ergibt einen Gedankenstrich, NICHT eine Null', () => {
    expect(statLabel('count', undefined, 'error')).toBe('–');
    expect(statLabel('recent', undefined, 'error')).toBe('–');
    // Auch wenn (veraltete) Zahlen vorliegen: im Fehlerfall keine Behauptung.
    expect(statLabel('count', stat, 'error')).toBe('–');
  });

  it('während des Ladens steht das dran', () => {
    expect(statLabel('count', undefined, 'loading')).toBe('Statistik lädt…');
  });

  it('im Normalfall wie bisher', () => {
    expect(statLabel('count', stat, 'ok')).toBe('3× gespielt');
    expect(statLabel('recent', stat, 'ok')).toBe('zuletzt: 05.07.2026');
    // Eine ECHTE Null bleibt eine Null – die Abgrenzung zum Fehlerfall.
    expect(statLabel('count', { count: 0, last: null }, 'ok')).toBe('0× gespielt');
  });
});

describe('filterSongs – ohne Statistik keine leere Liste (#300)', () => {
  it('bei fehlender Statistik bleiben ALLE Lieder stehen', () => {
    // Vorher: Sortierung nach Haeufigkeit + keine Zahlen = leere Liste mit der falschen Aussage
    // "In diesem Zeitraum wurde kein Lied gespielt." Auch 'Cedar' (nie gespielt) bleibt jetzt drin,
    // weil wir ohne Zahlen nicht behaupten koennen, dass es nie gespielt wurde.
    const r = filterSongs(SONGS, undefined, opts({ sort: 'count', usageAvailable: false }));
    expect(names(r.list)).toEqual(['Anker', 'Berg', 'Cedar']);
  });

  it('mit vorhandener Statistik wird wie bisher gefiltert', () => {
    // Gegenrichtung: Der Filter darf nicht generell abgeschaltet sein.
    const r = filterSongs(SONGS, USAGE, opts({ sort: 'count', usageAvailable: true }));
    expect(names(r.list)).toEqual(['Berg', 'Anker']);
    expect(r.list.find((x) => x.name === 'Cedar')).toBeUndefined();
  });

  it('ohne die Angabe verhaelt es sich wie bisher (Vorgabe true)', () => {
    const r = filterSongs(SONGS, USAGE, opts({ sort: 'count' }));
    expect(names(r.list)).toEqual(['Berg', 'Anker']);
  });
});

/**
 * Die Einzahl (#378) – **beim Durchklicken gefunden**, nicht von einem Test.
 *
 * Der Listenkopf im Liederheft schrieb „1 LIEDER". Die Regel stand an drei Stellen, zwei davon richtig;
 * mit den 49 Liedern der ECG wäre der Fehler nie aufgefallen – erst der E2E-Stub mit **einem** Lied
 * machte ihn sichtbar. Der Test steht hier, weil die Regel jetzt genau eine Stelle hat.
 */
describe('liedAnzahl – Einzahl und Mehrzahl', () => {
  it('bei einem Lied die Einzahl', () => {
    expect(liedAnzahl(1)).toBe('1 Lied');
  });

  it('bei mehreren die Mehrzahl', () => {
    expect(liedAnzahl(2)).toBe('2 Lieder');
    expect(liedAnzahl(49)).toBe('49 Lieder');
  });

  it('bei null ebenfalls die Mehrzahl – „0 Lied" gibt es nicht', () => {
    expect(liedAnzahl(0)).toBe('0 Lieder');
  });
});

describe('filterSongs – die CCLI-Nummer gehört zur Suche (#378)', () => {
  /**
   * Alwins Satz: „Ich tippe Titel oder Nummer und das Lied erscheint." Liegt das Lied schon bei uns,
   * muss es die Bibliothek finden – sonst führt die Nummer über SongSelect zu einem Doppel.
   */
  it('findet ein Lied über seine Nummer', () => {
    const r = filterSongs(SONGS, undefined, {
      query: '5841527',
      sort: 'name',
      from: '',
      to: '',
      showStats: false,
    });
    expect(r.list.map((s) => s.name)).toEqual(['Anker']);
  });

  it('auch über den Anfang der Nummer – man tippt sie ja Stelle für Stelle', () => {
    const r = filterSongs(SONGS, undefined, {
      query: '584',
      sort: 'name',
      from: '',
      to: '',
      showStats: false,
    });
    expect(r.list.map((s) => s.name)).toEqual(['Anker']);
  });

  it('ein Nummern-Treffer steht wie ein Titel-Treffer vor einem Autor-Treffer', () => {
    // „7" steckt in Cedars Nummer (7654321) und in Ankers Nummer (5841527) – beide sind Nummern-Treffer
    // und damit gleichrangig; danach entscheidet der Name. Ein Lied ohne Nummer und ohne „7" im Titel
    // fehlt.
    const r = filterSongs(SONGS, undefined, {
      query: '7',
      sort: 'name',
      from: '',
      to: '',
      showStats: false,
    });
    expect(r.list.map((s) => s.name)).toEqual(['Anker', 'Cedar']);
  });

  it('ohne Nummer (`null`) stürzt nichts ab', () => {
    const r = filterSongs(SONGS, undefined, {
      query: 'berg',
      sort: 'name',
      from: '',
      to: '',
      showStats: false,
    });
    expect(r.list.map((s) => s.name)).toEqual(['Berg']);
  });
});
