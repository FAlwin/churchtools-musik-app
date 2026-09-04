// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiedSuche, SUCH_ENTPRELLUNG_MS } from './useLiedSuche';

/**
 * Die Regeln des einen Suchfelds (#378, zweiter Anlauf 03.09.2026) – **hier liegt das Teure.**
 *
 * Jede SongSelect-Suche geht über ChurchTools weiter an CCLI (~800 ms gemessen) und zählt gegen die
 * Drosselung; die Liedtextsuche baut beim ersten Mal einen Index über einen Download je Lied. Was hier
 * schiefgeht, merkt man nicht in der Oberfläche, sondern an der Gegenstelle – so ist in #300 das
 * ChurchTools-Limit gerissen.
 *
 * **Mit Fake-Timern**, und das ist keine Kosmetik: Mit echten Timern erledigt die Entprellung nach ~400 ms
 * die Arbeit, die der Test der Regel zuschreibt – er wäre auch ohne sie grün. Genau dieser Fehler ist im
 * Projekt schon vorgekommen.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Lässt die Entprellung ablaufen. */
const warten = (ms = SUCH_ENTPRELLUNG_MS) => act(() => void vi.advanceTimersByTime(ms));

interface Props {
  e: string;
  leer: boolean;
  ccli?: boolean;
  anlegen?: boolean;
}

function baue(eingabe: string, bibliothekLeer: boolean, ccli = true, anlegen = true) {
  // Der Generic sagt renderHook, dass `ccli`/`anlegen` beim `rerender` fehlen dürfen – sonst leitet es
  // den Typ aus dem ersten Aufruf ab, wo alle vier stehen.
  return renderHook<ReturnType<typeof useLiedSuche>, Props>(
    ({ e, leer, ccli: c = true, anlegen: a = true }) =>
      useLiedSuche({ eingabe: e, canUseCcli: c, kannAnlegen: a, bibliothekLeer: leer }),
    { initialProps: { e: eingabe, leer: bibliothekLeer, ccli, anlegen } },
  );
}

describe('useLiedSuche – SongSelect fragt von selbst NUR bei leerer Bibliothek', () => {
  it('findet die Bibliothek etwas, läuft KEINE CCLI-Anfrage', () => {
    /**
     * Die teuerste Zusicherung dieser Datei. „Gnade" trifft bei den meisten Gemeinden eigene Lieder – dann
     * darf niemand bei CCLI nachfragen, bei jedem Anwender, den ganzen Tag.
     */
    const { result } = baue('Gnade', false);
    warten();
    expect(result.current.songSelectBegriff).toBe('');
    expect(result.current.angebotSongSelect).toBe(true);
  });

  it('findet sie nichts, wird der Begriff abgeschickt', () => {
    // Der STARTWERT ist nicht entprellt (`useEntprellt` gibt ihn sofort weiter) – entprellt wird das
    // Tippen danach. Deshalb hier keine Zusicherung „vorher leer"; die steht im Test zum Weitertippen.
    const { result } = baue('Wo ich auch stehe', true);
    warten();
    expect(result.current.songSelectBegriff).toBe('Wo ich auch stehe');
    // Läuft schon – das Angebot dazu wäre doppelt.
    expect(result.current.angebotSongSelect).toBe(false);
  });

  it('wartet die Entprellung ab, statt bei jedem Buchstaben zu fragen', () => {
    const { result, rerender } = baue('Gna', true);
    warten();
    expect(result.current.songSelectBegriff).toBe('Gna');

    rerender({ e: 'Gnade', leer: true });
    // Kurz vor Ablauf gilt nichts mehr: Der alte Begriff steht nicht mehr im Feld, der neue ist noch
    // nicht abgeschickt. Genau in dieser Lücke darf keine Trefferliste zu „Gna" stehen.
    warten(SUCH_ENTPRELLUNG_MS - 1);
    expect(result.current.songSelectBegriff).toBe('');
    warten(1);
    expect(result.current.songSelectBegriff).toBe('Gnade');
  });

  it('wird die Bibliothek erst beim Weitertippen leer, startet SongSelect dann', () => {
    // „Tre" trifft „Treu"; „Treue Lie" trifft nichts mehr – ab da fragt CCLI.
    const { result, rerender } = baue('Tre', false);
    warten();
    expect(result.current.songSelectBegriff).toBe('');

    rerender({ e: 'Treue Lie', leer: true });
    warten();
    expect(result.current.songSelectBegriff).toBe('Treue Lie');
  });

  it('unter drei Zeichen läuft nichts – auch bei leerer Bibliothek', () => {
    const { result } = baue('Gn', true);
    warten();
    expect(result.current.songSelectBegriff).toBe('');
    expect(result.current.angebotSongSelect).toBe(false);
  });

  it('eine unvollständige CCLI-Nummer wird NICHT von selbst abgefragt', () => {
    /**
     * Gemessen (13.08.2026): Alle 46 vergebenen Nummern im Bestand der ECG haben 7 Stellen. Ohne diese
     * Regel meldete die App beim Eintippen viermal „findet CCLI kein Lied", bevor die Nummer fertig ist.
     * Das Angebot bleibt – wer die Nummer so meint, tippt darauf.
     */
    const { result } = baue('584', true);
    warten();
    expect(result.current.songSelectBegriff).toBe('');
    expect(result.current.angebotSongSelect).toBe(true);
  });

  it('eine vollständige Nummer schon', () => {
    const { result } = baue('5841527', true);
    warten();
    expect(result.current.songSelectBegriff).toBe('5841527');
  });

  it('ohne Lizenz gibt es SongSelect nicht – weder von selbst noch als Angebot', () => {
    const { result } = baue('Wo ich auch stehe', true, false, true);
    warten();
    expect(result.current.songSelectMoeglich).toBe(false);
    expect(result.current.songSelectBegriff).toBe('');
    expect(result.current.angebotSongSelect).toBe(false);
  });

  it('ohne Weg zum Anlegen ebenfalls nicht – ein Treffer ohne Ziel wäre eine Sackgasse', () => {
    /**
     * Der Fall „Lied verknüpfen" und das Liederheft: Dort kann aus einem SongSelect-Treffer kein Lied
     * werden. Ein Angebot dorthin führte ins Leere.
     */
    const { result } = baue('Wo ich auch stehe', true, true, false);
    warten();
    expect(result.current.songSelectBegriff).toBe('');
    expect(result.current.angebotSongSelect).toBe(false);
  });

  it('fällt die Lizenz weg, verschwinden laufende Treffer – abgeleitet, nicht per Effekt', () => {
    // Beim ersten Rendern sind die Rechte noch nicht geladen; eine Lizenz kann in ChurchTools auch
    // wegfallen. Ein Zustand, der sich nachträglich selbst richtigstellt, war in #283 die Ursache für
    // einen Menüpunkt, der still nichts mehr tat.
    const { result, rerender } = baue('Wo ich auch stehe', true);
    warten();
    expect(result.current.songSelectBegriff).toBe('Wo ich auch stehe');
    rerender({ e: 'Wo ich auch stehe', leer: true, ccli: false });
    expect(result.current.songSelectBegriff).toBe('');
  });
});

describe('useLiedSuche – das Angebot „Bei SongSelect suchen"', () => {
  it('schickt sofort ab, ohne die Entprellung abzuwarten', () => {
    const { result } = baue('Gnade', false);
    act(() => result.current.songSelectSuchen());
    expect(result.current.songSelectBegriff).toBe('Gnade');
  });

  it('übergeht die 7-Stellen-Regel – eine kurze Nummer darf man abfragen', () => {
    // Die 7 Stellen sind eine Beobachtung an einem Bestand, kein Gesetz von CCLI.
    const { result } = baue('584', true);
    warten();
    expect(result.current.songSelectBegriff).toBe('');
    act(() => result.current.songSelectSuchen());
    expect(result.current.songSelectBegriff).toBe('584');
  });

  it('unter drei Zeichen tut es nichts', () => {
    const { result } = baue('Gn', false);
    act(() => result.current.songSelectSuchen());
    expect(result.current.songSelectBegriff).toBe('');
  });

  it('die Treffer gelten nur, solange der Begriff im Feld steht', () => {
    const { result, rerender } = baue('Gnade', false);
    act(() => result.current.songSelectSuchen());
    expect(result.current.songSelectBegriff).toBe('Gnade');

    rerender({ e: 'Gnad', leer: false });
    // Ein Zeichen gelöscht: Die alten Treffer sind weg, das Angebot ist wieder da.
    expect(result.current.songSelectBegriff).toBe('');
    expect(result.current.angebotSongSelect).toBe(true);
  });
});

describe('useLiedSuche – die Liedtextsuche läuft NIE von selbst', () => {
  it('auch bei leerer Bibliothek und reifem Begriff nicht', () => {
    /**
     * Der erste Aufruf kostet serverseitig einen Download je Lied. Anders als bei SongSelect gibt es hier
     * keine Ausnahme: Ein Wort, das kein Titel enthält, ist noch kein Grund, alle Texte zu holen.
     */
    const { result } = baue('gnade', true);
    warten();
    expect(result.current.liedtextBegriff).toBe('');
    expect(result.current.angebotLiedtexte).toBe(true);
  });

  it('das Angebot fehlt unter drei Zeichen – das träfe fast jedes Lied', () => {
    const { result } = baue('gn', true);
    expect(result.current.angebotLiedtexte).toBe(false);
    act(() => result.current.liedtexteSuchen());
    expect(result.current.liedtextBegriff).toBe('');
  });

  it('ab drei Zeichen schickt das Angebot ab', () => {
    const { result } = baue('gnade', false);
    act(() => result.current.liedtexteSuchen());
    expect(result.current.liedtextBegriff).toBe('gnade');
    expect(result.current.angebotLiedtexte).toBe(false);
  });

  it('die Treffer gelten nur, solange der Begriff im Feld steht', () => {
    // Die Regel aus dem Liederheft (`textSuche === query`), jetzt einmal hier.
    const { result, rerender } = baue('gnade', false);
    act(() => result.current.liedtexteSuchen());
    rerender({ e: 'gnaden', leer: false });
    expect(result.current.liedtextBegriff).toBe('');
    expect(result.current.angebotLiedtexte).toBe(true);
  });

  it('gibt es auch ohne SongSelect – Suchen darf jeder', () => {
    const { result } = baue('gnade', true, false, false);
    expect(result.current.angebotLiedtexte).toBe(true);
  });
});
