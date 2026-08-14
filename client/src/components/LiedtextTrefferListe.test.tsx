// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SongLibraryEntry, SongTextTreffer } from '@shared/types/index';

/**
 * Die Trefferliste der Quelle „Liedtexte" (#378) – herausgezogen aus `AllSongs`, weil sie seit dem
 * Quellen-Umschalter an drei Stellen erscheint.
 *
 * Zwei Zusicherungen tragen hier das Gewicht:
 *
 *  - **Ohne Begriff wird nicht gesucht.** Der Aufbau des Index kostet serverseitig einen Datei-Download
 *    je Lied; ein Tipp auf den Reiter ist kein Suchauftrag.
 *  - **Ein Treffer, den die Bibliothek nicht kennt, bleibt unantastbar.** Der Index hält eine Stunde,
 *    die Liederliste ist frischer – ein gerade gelöschtes Lied stünde noch im Index. Anklickbar wäre er
 *    ein Fehlerschirm, weggelassen wäre er eine Lüge.
 */
const suche = vi.fn();
vi.mock('../hooks/useServices', () => ({
  useLiedtextSuche: (begriff: string, enabled: boolean) => suche(begriff, enabled),
  // Die Vorschau (#379) haengt mit in jeder Zeile; hier nur stillgelegt – sie hat ihren eigenen Test.
  useLiedtextVorschau: () => ({ data: undefined, isLoading: false, isError: false }),
}));

const { LiedtextTrefferListe } = await import('./LiedtextTrefferListe');

const BESTAND: SongLibraryEntry[] = [
  { songId: 3, name: 'Treu', author: null, key: 'D', arrangementId: 30 },
];

const TREFFER: SongTextTreffer[] = [
  { songId: 3, name: 'Treu', ausschnitt: '… deine treue trägt mich jeden tag …' },
];

const onPick = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  suche.mockReturnValue({ data: [], isLoading: false, isError: false });
});

function zeige(begriff: string, songs = BESTAND) {
  return render(<LiedtextTrefferListe begriff={begriff} songs={songs} onPick={onPick} />);
}

/**
 * Die Treffer-Zeile – **einmal benannt, und zwar über den Ausschnitt.**
 *
 * Ein `getByRole('button', { name: /Treu/ })` traf ab #379 zwei Knöpfe: die Zeile und den „Text
 * zeigen"-Knopf der Vorschau, deren Vorlesetext den Liednamen enthält. Der Ausschnitt gehört dagegen nur
 * der Zeile.
 */
const trefferZeile = () => screen.getByRole('button', { name: /deine treue trägt/ });

describe('LiedtextTrefferListe – ohne Begriff wird nicht gesucht', () => {
  it('erklärt die Mindestlänge, statt eine leere Liste zu zeigen', () => {
    zeige('');
    expect(screen.getByText(/mindestens 3 Zeichen/)).toBeTruthy();
  });

  it('schaltet die Abfrage ab – der Reiter allein baut keinen Index', () => {
    // Geprüft wird das Argument: Nur so fällt der Test, wenn die Abschaltung bricht.
    zeige('');
    expect(suche).toHaveBeenCalledWith('', false);
  });

  it('mit Begriff läuft sie', () => {
    zeige('treue');
    expect(suche).toHaveBeenCalledWith('treue', true);
  });
});

describe('LiedtextTrefferListe – Treffer', () => {
  it('zeigt Namen und den Ausschnitt, der den Fund erklärt', () => {
    suche.mockReturnValue({ data: TREFFER, isLoading: false, isError: false });
    zeige('treue');

    expect(screen.getByText('Treu')).toBeTruthy();
    expect(screen.getByText(/deine treue trägt/)).toBeTruthy();
  });

  it('zählt in der Überschrift richtig – „1 Lied", nicht „1 Lieder"', () => {
    suche.mockReturnValue({ data: TREFFER, isLoading: false, isError: false });
    zeige('treue');
    expect(screen.getByText(/^1 Lied mit/)).toBeTruthy();
  });

  it('gibt beim Antippen den Bibliothekseintrag weiter – der trägt das Arrangement', () => {
    suche.mockReturnValue({ data: TREFFER, isLoading: false, isError: false });
    zeige('treue');
    fireEvent.click(trefferZeile());
    expect(onPick).toHaveBeenCalledWith(BESTAND[0]);
  });

  it('bietet die Liedtext-Vorschau an – der Ausschnitt zeigt nur die Fundstelle (#379)', () => {
    suche.mockReturnValue({ data: TREFFER, isLoading: false, isError: false });
    zeige('treue');
    expect(screen.getByRole('button', { name: /Liedtext-Anfang von „Treu" zeigen/ })).toBeTruthy();
  });

  it('ein Treffer, den die Bibliothek nicht kennt, ist gesperrt statt versteckt', () => {
    /**
     * Der Index hält eine Stunde, die Liederliste ist frischer. Ein in ChurchTools gerade gelöschtes
     * Lied stünde also noch im Index – anklickbar wäre es ein Fehlerschirm.
     */
    suche.mockReturnValue({ data: TREFFER, isLoading: false, isError: false });
    zeige('treue', []);

    const zeile = trefferZeile();
    expect(zeile.hasAttribute('disabled')).toBe(true);
    fireEvent.click(zeile);
    expect(onPick).not.toHaveBeenCalled();
    // Und keine Vorschau: Zu einem Lied, das die Liste nicht kennt, gibt es nichts anzubieten.
    expect(screen.queryByRole('button', { name: /Liedtext-Anfang/ })).toBeNull();
  });

  it('sagt beim ersten Mal, warum es dauert', () => {
    suche.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    zeige('treue');
    expect(screen.getByText(/Beim ersten Mal dauert das einen Moment/)).toBeTruthy();
  });

  it('unterscheidet „nichts gefunden" von „konnte nicht suchen" (#270)', () => {
    // Die Drosselung von ChurchTools ist kein leeres Ergebnis – der Grund kommt vom Server.
    suche.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('ChurchTools bremst uns aus. Bitte in 2 Minuten erneut versuchen.'),
    });
    zeige('treue');

    expect(screen.getByText(/bremst uns aus/)).toBeTruthy();
    expect(screen.queryByText(/steht „treue" nicht/)).toBeNull();
  });

  it('sagt bei null Treffern, dass das Wort auch im Text nicht steht', () => {
    zeige('gibtsnicht');
    expect(screen.getByText(/steht „gibtsnicht" nicht/)).toBeTruthy();
  });
});
