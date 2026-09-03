// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { SongLibraryEntry, SongSelectSuchergebnis } from '@shared/types/index';

/**
 * Die Lied-Auswahl beim Einfügen (#378, #379).
 *
 * **Die teuerste Zusicherung zuerst: Beim Durchsehen der Liste wird KEIN Liedtext abgefragt.** Erst wenn
 * ein Lied wirklich geöffnet wird, läuft eine Anfrage. Bei SongSelect ist das mehr als eine Frage der
 * Sparsamkeit: Ob CCLI einen Textabruf als Nutzung verbucht, ist offen (gemessen wurde nur, dass die
 * Antwort keinen Hinweis darauf enthält). Geprüft wird das am **`enabled`-Argument** der Hooks – an der
 * Darstellung wäre nur der Mock geprüft.
 *
 * Dazu die zwei Wege, die Alwin ausdrücklich beide wollte: **Antippen → Vorschau** (Muster ProPresenter)
 * und **„+" → sofort einfügen** (im Gottesdienst zählt der kurze Weg).
 */
const caps = vi.fn();
const lib = vi.fn();
const usage = vi.fn();
const eigenerText = vi.fn();
const ccliText = vi.fn();
const songSelectSuche = vi.fn();

vi.mock('../hooks/useServices', () => ({
  SONGSELECT_MIN_ZEICHEN: 3,
  useCapabilities: () => caps(),
  useSongLibrary: () => lib(),
  useSongUsage: () => usage(),
  useLiedtextVorschau: (songId: number, enabled: boolean) => eigenerText(songId, enabled),
  useSongSelectLiedtext: (nr: number | null, enabled: boolean) => ccliText(nr, enabled),
  useSongSelectSuche: () => songSelectSuche(),
  useLiedtextSuche: () => ({ data: [], isLoading: false, isError: false }),
}));

/**
 * **`useLiedSuche` wird NICHT gemockt** – bewusst.
 *
 * Ein Mock müsste seine Regeln nachbauen (wann SongSelect von selbst fragt, wann nur ein Angebot steht),
 * und ein nachgebauter Regelsatz im Test ist genau die Dopplung, die dieses Projekt teuer bezahlt hat.
 * Stattdessen läuft der echte Hook, und die Entprellung wird mit **Fake-Timern** vorgespult.
 */
const warten = () => act(() => void vi.advanceTimersByTime(500));

const { SongPicker } = await import('./SongPicker');

const BESTAND: SongLibraryEntry[] = [
  { songId: 3, name: 'Treu', author: 'Autor T', key: 'D', arrangementId: 30 },
];

const SS_TREFFER: SongSelectSuchergebnis = {
  treffer: [
    {
      songNumber: 5841527,
      title: 'Stub-Lied',
      authors: ['CCLI-Autor'],
      defaultKey: 'E',
      isPublicDomain: false,
      hasLyrics: true,
      hasChordPro: true,
      hasChordSheet: true,
    },
  ],
  gesamt: 1,
  vollstaendig: true,
};

const onPick = vi.fn();
const onSongSelectTreffer = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  caps.mockReturnValue({ data: { canViewAgendas: false, canUseCcli: true } });
  lib.mockReturnValue({ data: BESTAND, isLoading: false, isError: false });
  usage.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  eigenerText.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  ccliText.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  songSelectSuche.mockReturnValue({ data: SS_TREFFER, isLoading: false, isError: false });
});

afterEach(() => vi.useRealTimers());

function zeige(props: Partial<Parameters<typeof SongPicker>[0]> = {}) {
  return render(<SongPicker onPick={onPick} {...props} />);
}

/**
 * Die Lied-Zeile – **über den Autor benannt.** Ein `/Treu/` traf zwei Knöpfe: die Zeile und den
 * „+"-Direktknopf, dessen Vorlesetext den Liednamen enthält. Der Autor gehört nur der Zeile.
 */
const liedZeile = () => screen.getByRole('button', { name: /Autor T/ });
const direktKnopf = () => screen.getByRole('button', { name: /ohne Vorschau hinzufügen/ });

/**
 * Einen Begriff tippen, den die Bibliothek NICHT kennt („stub" trifft „Treu" nicht) – dann fragt
 * SongSelect nach der Entprellung von selbst (Regel aus `useLiedSuche`, 03.09.2026).
 */
function zuSongSelect() {
  fireEvent.change(screen.getByPlaceholderText(/Lied oder Autor/), { target: { value: 'stub' } });
  warten();
}

describe('SongPicker – in der Liste wird kein Liedtext geholt', () => {
  it('die Vorschau-Abfrage ist abgeschaltet, solange die Liste zu sehen ist', () => {
    zeige();
    expect(eigenerText).toHaveBeenCalledWith(0, false);
  });

  it('die CCLI-Abfrage ebenfalls – dort ist es besonders wichtig', () => {
    /**
     * Ob CCLI einen Textabruf verbucht, ist offen. Eine Anfrage beim Durchsehen von 147 Treffern wäre
     * genau das, was niemand will.
     */
    zeige({ onSongSelectTreffer });
    expect(ccliText).toHaveBeenCalledWith(null, false);
  });
});

describe('SongPicker – zwei Wege, wie Alwin sie wollte', () => {
  it('Antippen führt in die VORSCHAU, nicht direkt zum Einfügen', () => {
    zeige();
    fireEvent.click(liedZeile());

    // Die Vorschau ist da (mit ihrer Aktion) – und `onPick` ist NICHT gelaufen.
    expect(screen.getByRole('button', { name: 'Zum Ablauf hinzufügen' })).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('erst in der Vorschau wird der Text geholt', () => {
    zeige();
    fireEvent.click(liedZeile());
    expect(eigenerText).toHaveBeenLastCalledWith(3, true);
  });

  it('aus der Vorschau heraus fügt die Aktion ein', () => {
    zeige();
    fireEvent.click(liedZeile());
    fireEvent.click(screen.getByRole('button', { name: 'Zum Ablauf hinzufügen' }));
    expect(onPick).toHaveBeenCalledWith(30, 'Treu');
  });

  it('der „+"-Knopf fügt SOFORT ein – ohne Vorschau, ohne Textabfrage', () => {
    // Der kurze Weg für den Gottesdienst (Entscheidung Alwin, 14.08.2026).
    zeige();
    fireEvent.click(direktKnopf());

    expect(onPick).toHaveBeenCalledWith(30, 'Treu');
    expect(eigenerText).not.toHaveBeenCalledWith(3, true);
  });

  it('die Beschriftung der Aktion kommt vom Aufrufer', () => {
    zeige({ aktionLabel: 'Mit diesem Eintrag verknüpfen' });
    fireEvent.click(liedZeile());
    expect(screen.getByRole('button', { name: 'Mit diesem Eintrag verknüpfen' })).toBeTruthy();
  });
});

describe('SongPicker – SongSelect', () => {
  it('ein Treffer führt in die Vorschau, und DORT wird CCLI gefragt', () => {
    zeige({ onSongSelectTreffer });
    zuSongSelect();
    fireEvent.click(screen.getByRole('button', { name: /Stub-Lied/ }));

    expect(ccliText).toHaveBeenLastCalledWith(5841527, true);
    // Noch ist nichts angelegt – erst die Aktion in der Vorschau führt weiter.
    expect(onSongSelectTreffer).not.toHaveBeenCalled();
  });

  it('die Aktion heißt „Als neues Lied anlegen …" und gibt den Treffer weiter', () => {
    zeige({ onSongSelectTreffer });
    zuSongSelect();
    fireEvent.click(screen.getByRole('button', { name: /Stub-Lied/ }));
    fireEvent.click(screen.getByRole('button', { name: /Als neues Lied anlegen/ }));

    expect(onSongSelectTreffer).toHaveBeenCalledWith(SS_TREFFER.treffer[0]);
  });

  it('findet die Bibliothek etwas, gibt es SongSelect nur als ANGEBOT – keine Anfrage von selbst', () => {
    /**
     * Die teuerste Zusicherung: „Tre" trifft „Treu", also darf niemand bei CCLI nachfragen. Das Angebot
     * steht darunter; erst der Tipp darauf schickt ab.
     */
    zeige({ onSongSelectTreffer });
    fireEvent.change(screen.getByPlaceholderText(/Lied oder Autor/), { target: { value: 'Tre' } });
    warten();

    expect(screen.queryByText(/Stub-Lied/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Bei SongSelect nach „Tre" suchen/ }));
    expect(screen.getByRole('button', { name: /Stub-Lied/ })).toBeTruthy();
    // Die Gruppe ist beschriftet – ein CCLI-Treffer sieht einem eigenen Lied sonst zum Verwechseln ähnlich.
    expect(screen.getByText(/SongSelect · 1 Treffer zu „Tre"/)).toBeTruthy();
  });

  it('findet sie NICHTS, fragt SongSelect von selbst – ohne Tipp', () => {
    zeige({ onSongSelectTreffer });
    zuSongSelect();
    expect(screen.getByRole('button', { name: /Stub-Lied/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Bei SongSelect nach/ })).toBeNull();
  });

  it('ohne Weg zum Anlegen gibt es SongSelect gar nicht – kein Treffer ohne Ziel', () => {
    // „Lied verknüpfen": Einem vorhandenen Ablaufpunkt wird ein Lied zugeordnet, ein neues könnte dort
    // nicht landen. Weder Angebot noch automatische Suche.
    zeige();
    zuSongSelect();
    expect(screen.queryByText(/Stub-Lied/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Bei SongSelect nach/ })).toBeNull();
    // Die Liedtexte bleiben – Suchen darf jeder.
    expect(
      screen.getByRole('button', { name: /Auch in den Liedtexten nach „stub" suchen/ }),
    ).toBeTruthy();
  });

  it('es gibt keinen Umschalter mehr', () => {
    // Gegenprobe zur Entscheidung vom 03.09.2026.
    zeige({ onSongSelectTreffer });
    expect(screen.queryByRole('button', { name: 'Bibliothek' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Liedtexte' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'SongSelect' })).toBeNull();
  });
});
