// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiedSuche, SUCH_ENTPRELLUNG_MS, type LiedQuelle } from './useLiedSuche';

/**
 * Die Regeln des Quellen-Umschalters (#378) – **hier liegt das Teure.**
 *
 * Die drei Quellen kosten sehr Unterschiedliches: Die Bibliothek filtert im Browser, die Liedtexte lassen
 * den Server beim ersten Mal **einen Datei-Download je Lied** machen, und jede SongSelect-Suche geht über
 * ChurchTools weiter an CCLI (~800 ms gemessen). Was hier schiefgeht, merkt man nicht in der Oberfläche,
 * sondern an der Gegenstelle – so ist in #300 das ChurchTools-Limit gerissen.
 *
 * **Mit Fake-Timern**, und das ist keine Kosmetik: Mit echten Timern erledigt die Entprellung nach ~400 ms
 * die Arbeit, die der Test der Regel zuschreibt – er wäre auch ohne sie grün. Genau dieser Fehler ist im
 * Projekt schon vorgekommen.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Lässt die Entprellung ablaufen. */
const warten = (ms = SUCH_ENTPRELLUNG_MS) => act(() => void vi.advanceTimersByTime(ms));

function baue(eingabe = '', canUseCcli = true, kannAnlegen = true) {
  return renderHook(
    ({ e }: { e: string }) => useLiedSuche({ eingabe: e, canUseCcli, kannAnlegen }),
    { initialProps: { e: eingabe } },
  );
}

describe('useLiedSuche – welche Quellen es gibt', () => {
  it('mit Lizenz und Anlege-Weg alle drei, Bibliothek zuerst', () => {
    const { result } = baue();
    expect(result.current.quellen).toEqual<LiedQuelle[]>(['bibliothek', 'liedtext', 'songselect']);
    expect(result.current.quelle).toBe('bibliothek');
  });

  it('ohne SongSelect-Lizenz bleiben zwei', () => {
    const { result } = baue('', false, true);
    expect(result.current.quellen).toEqual<LiedQuelle[]>(['bibliothek', 'liedtext']);
  });

  it('ohne Weg zum Anlegen ebenfalls zwei – ein Treffer ohne Ziel wäre eine Sackgasse', () => {
    /**
     * Der Fall „Lied verknüpfen": Dort wird einem **vorhandenen** Ablaufpunkt ein Lied zugeordnet; ein
     * neu angelegtes Lied könnte dort nicht landen. Deshalb fehlt der Reiter.
     */
    const { result } = baue('', true, false);
    expect(result.current.quellen).toEqual<LiedQuelle[]>(['bibliothek', 'liedtext']);
  });

  it('fällt auf die Bibliothek zurück, wenn die gewählte Quelle verschwindet', () => {
    /**
     * Beim ersten Rendern sind die Rechte noch nicht geladen, und eine Lizenz kann in ChurchTools auch
     * wegfallen. Dann darf man nicht auf einem Reiter stehen, den es nicht mehr gibt. Abgeleitet statt in
     * einem Effekt korrigiert – ein Zustand, der sich selbst nachträglich richtigstellt, war in #283 die
     * Ursache für einen Menüpunkt, der still nichts mehr tat.
     */
    const { result, rerender } = renderHook(
      ({ ccli }: { ccli: boolean }) =>
        useLiedSuche({ eingabe: 'Gnade', canUseCcli: ccli, kannAnlegen: true }),
      { initialProps: { ccli: true } },
    );

    act(() => result.current.setQuelle('songselect'));
    expect(result.current.quelle).toBe('songselect');

    rerender({ ccli: false });
    expect(result.current.quelle).toBe('bibliothek');
  });
});

describe('useLiedSuche – SongSelect wird nur gefragt, wenn es sichtbar ist', () => {
  it('in der Bibliothek getippter Text löst KEINE CCLI-Abfrage aus', () => {
    /**
     * Die teuerste Zusicherung dieser Datei. Ohne sie fragte jedes Tippen im Liederheft bei CCLI nach –
     * bei jedem Anwender, den ganzen Tag.
     */
    const { result } = baue('Gnade');
    warten();
    expect(result.current.songSelectBegriff).toBe('');
  });

  it('nach dem Wechsel wird der stehende Begriff abgeschickt – ohne neuen Tastendruck', () => {
    const { result } = baue('Gnade');
    warten();
    act(() => result.current.setQuelle('songselect'));
    expect(result.current.songSelectBegriff).toBe('Gnade');
  });

  it('wartet die Entprellung ab, statt bei jedem Buchstaben zu fragen', () => {
    const { result, rerender } = baue('Gna');
    act(() => result.current.setQuelle('songselect'));
    warten();
    expect(result.current.songSelectBegriff).toBe('Gna');

    rerender({ e: 'Gnade' });
    // Kurz vor Ablauf steht noch der alte Begriff – der neue ist noch nicht abgeschickt.
    warten(SUCH_ENTPRELLUNG_MS - 1);
    expect(result.current.songSelectBegriff).toBe('Gna');
    warten(1);
    expect(result.current.songSelectBegriff).toBe('Gnade');
  });

  it('unter drei Zeichen läuft nichts', () => {
    const { result } = baue('Gn');
    act(() => result.current.setQuelle('songselect'));
    warten();
    expect(result.current.songSelectBegriff).toBe('');
  });

  it('eine unvollständige CCLI-Nummer wird NICHT von selbst abgefragt', () => {
    /**
     * Gemessen (13.08.2026): Alle 46 vergebenen Nummern im Bestand der ECG haben 7 Stellen. Ohne diese
     * Regel meldete die App beim Eintippen viermal „findet CCLI kein Lied", bevor die Nummer fertig ist.
     */
    const { result } = baue('584');
    act(() => result.current.setQuelle('songselect'));
    warten();
    expect(result.current.songSelectBegriff).toBe('');
  });

  it('eine vollständige Nummer schon', () => {
    const { result } = baue('5841527');
    act(() => result.current.setQuelle('songselect'));
    warten();
    expect(result.current.songSelectBegriff).toBe('5841527');
  });

  it('`jetztSuchen` übergeht die Schwelle – eine kurze Nummer darf man abfragen', () => {
    // Die 7 Stellen sind eine Beobachtung an einem Bestand, kein Gesetz von CCLI.
    const { result } = baue('584');
    act(() => result.current.setQuelle('songselect'));
    warten();
    act(() => result.current.jetztSuchen());
    expect(result.current.songSelectBegriff).toBe('584');
  });

  it('`jetztSuchen` wartet die Entprellung nicht ab', () => {
    const { result, rerender } = baue('Gna');
    act(() => result.current.setQuelle('songselect'));
    warten();
    rerender({ e: 'Gnade' });
    act(() => result.current.jetztSuchen());
    expect(result.current.songSelectBegriff).toBe('Gnade');
  });
});

describe('useLiedSuche – die Liedtextsuche und ihr Index', () => {
  it('ein Wechsel auf den Reiter allein baut noch keinen Index', () => {
    /**
     * Der erste Aufruf kostet serverseitig einen Download je Lied. Ein Reitertipp ist kein Suchauftrag –
     * deshalb braucht es einen Begriff.
     */
    const { result } = baue('');
    act(() => result.current.setQuelle('liedtext'));
    warten();
    expect(result.current.liedtextBegriff).toBe('');
  });

  it('unter drei Zeichen wird nicht gesucht – das träfe fast jedes Lied', () => {
    const { result } = baue('gn');
    act(() => result.current.setQuelle('liedtext'));
    warten();
    expect(result.current.liedtextBegriff).toBe('');
  });

  it('ab drei Zeichen und nach der Entprellung', () => {
    const { result } = baue('gnade');
    act(() => result.current.setQuelle('liedtext'));
    warten();
    expect(result.current.liedtextBegriff).toBe('gnade');
  });

  it('in einer anderen Quelle bleibt sie still', () => {
    // Gegenprobe zur Zeile darüber: Derselbe Begriff, andere Quelle – kein Index-Aufbau.
    const { result } = baue('gnade');
    act(() => result.current.setQuelle('songselect'));
    warten();
    expect(result.current.liedtextBegriff).toBe('');
  });

  it('anders als bei SongSelect gibt es hier kein „trotzdem abschicken"', () => {
    const { result } = baue('gn');
    act(() => result.current.setQuelle('liedtext'));
    act(() => result.current.jetztSuchen());
    warten();
    expect(result.current.liedtextBegriff).toBe('');
  });
});

describe('useLiedSuche – inBibliothek', () => {
  it('sagt dem Aufrufer, wann er seine eigene Liste zeigt', () => {
    const { result } = baue('Gnade');
    expect(result.current.inBibliothek).toBe(true);
    act(() => result.current.setQuelle('liedtext'));
    expect(result.current.inBibliothek).toBe(false);
  });
});
