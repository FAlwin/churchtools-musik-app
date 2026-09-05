// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type {
  SongCategory,
  SongLibraryEntry,
  SongSelectSong,
  SongSelectTreffer,
  UserCapabilities,
} from '@shared/types/index';

/**
 * Das Blatt „Neues Lied" (#322, Schritt 10b; umgebaut in #378) – geprüft werden die **Entscheidungen**,
 * nicht das Aussehen:
 *
 *  - Die **Kategorie ist Pflicht ohne Vorbelegung** (Alwin, 13.08.2026): Ohne Wahl bleibt der Knopf
 *    gesperrt, und keine Kategorie ist beim Öffnen ausgewählt. Genau deshalb führt ein SongSelect-Treffer
 *    hierher und nicht direkt nach ChurchTools.
 *  - Ohne freigegebene Kategorie erscheint **kein Formular**, sondern ein ehrlicher Satz – sonst
 *    füllt jemand alles aus und ChurchTools lehnt am Ende ab.
 *  - Gleicher Liedname **warnt**, blockiert aber nicht.
 *  - Ein `startTreffer` **füllt das Formular**, und das nachgeholte Copyright kommt dazu.
 *
 * **Was hier NICHT mehr steht:** die Wegwahl und die SongSelect-Suche. Beide sind mit #378 in den
 * gemeinsamen Suchkopf gewandert; ihre Zusicherungen stehen jetzt in `LiedSucheKopf.test.tsx`,
 * `SongSelectTrefferListe.test.tsx` und `useLiedSuche.test.ts` – **umgezogen, nicht gelöscht.**
 */
const caps = vi.fn();
const kategorien = vi.fn();
const bibliothek = vi.fn();
const details = vi.fn();
vi.mock('../hooks/useServices', () => ({
  SONGSELECT_MIN_ZEICHEN: 3,
  useCapabilities: () => caps(),
  useSongCategories: () => kategorien(),
  useSongLibrary: () => bibliothek(),
  // Das Argument wird durchgereicht: Daran hängt die Zusicherung, dass ohne Treffer NICHTS abgefragt wird.
  useSongSelectSong: (songNumber: number | null) => details(songNumber),
}));

const anlegen = vi.fn();
const notenblattText = vi.fn();
const notenblattSpeichern = vi.fn();
/** Das Ergebnis des Anlegens – `null` = Formular, sonst Erfolgsansicht. Je Test setzbar. */
const hookErgebnis = vi.fn();
vi.mock('../hooks/useNeuesLied', () => ({
  useNeuesLied: () => ({
    anlegen,
    laeuft: false,
    fehler: null,
    ungewiss: false,
    ergebnis: hookErgebnis(),
    zuruecksetzen: vi.fn(),
    notenblattText,
    notenblattSpeichern,
    notenblattLaeuft: false,
    notenblattFehler: null,
  }),
}));

/**
 * Der Editor ist im Test eine Attrappe: Sein Innenleben (Cursor, Akkord-Baukasten) gehört nicht
 * hierher, und in jsdom rendert es nicht sauber. Geprüft wird die VERDRAHTUNG – welcher Text hinein
 * kommt und dass Speichern den Hook trifft.
 */
vi.mock('./ChordEditor', () => ({
  ChordEditor: (p: {
    initialText: string;
    mitVersionsname?: boolean;
    onSave: (t: string, n: string) => void;
  }) => (
    <div>
      <div data-testid="editor-text">{p.initialText}</div>
      <div data-testid="editor-versionsname">{String(p.mitVersionsname)}</div>
      <button onClick={() => p.onSave('{title: Neu}\n[D]Text', '')}>Editor speichern</button>
    </div>
  ),
}));

const { NewSongSheet } = await import('./NewSongSheet');

const KATEGORIEN: SongCategory[] = [
  { id: 0, name: 'Aktive Songs' },
  { id: 1, name: 'Inaktive Songs' },
];

const BESTAND: SongLibraryEntry[] = [
  { songId: 3, name: 'Treu', author: null, ccli: null, key: null, arrangementId: 30 },
];

/**
 * **Typisiert, und das ist der Punkt** (13.08.2026): Ein Mock, der die Form selbst erfindet, deckt einen
 * Formfehler nicht auf – der Absturz `.map is not a function` überlebte einen grünen Test, weil Mock und
 * Code dieselbe falsche Annahme teilten. Mit dem geteilten Typ kann das nicht mehr passieren.
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

const VOLL: SongSelectSong = { ...TREFFER, copyright: '© 2019 Verlag' };

/** Nur die Felder, die dieses Blatt liest – der Rest der Rechte spielt hier keine Rolle. */
function rechte(canUseCcli: boolean): { data: Partial<UserCapabilities> } {
  return { data: { canUseCcli, canEditSongs: true } };
}

/**
 * Generisch statt `as HTMLInputElement`: Die Zusicherung braucht `tsc` für `.value`, während die
 * Lint-Regel `no-unnecessary-type-assertion` sie für überflüssig hält (sie sieht die Testdatei ohne
 * Typprogramm). Die generische Form stellt beide zufrieden – dieselbe Lehre steht in `TempoMenu.test.tsx`.
 */
const nameFeld = () => screen.getByPlaceholderText<HTMLInputElement>('Titel des Liedes');

beforeEach(() => {
  vi.clearAllMocks();
  hookErgebnis.mockReturnValue(null);
  notenblattText.mockResolvedValue('{title: Wo ich auch stehe}\n{key: C}');
  notenblattSpeichern.mockResolvedValue(true);
  caps.mockReturnValue(rechte(false));
  kategorien.mockReturnValue({ data: KATEGORIEN, isLoading: false, isError: false });
  bibliothek.mockReturnValue({ data: BESTAND });
  details.mockReturnValue({ data: undefined, isLoading: false, isError: false });
});

function zeige(props: Partial<Parameters<typeof NewSongSheet>[0]> = {}) {
  return render(<NewSongSheet onClose={vi.fn()} {...props} />);
}

describe('NewSongSheet – Kategorie ist Pflicht', () => {
  it('keine Kategorie ist vorbelegt, und der Knopf bleibt gesperrt', () => {
    zeige();
    fireEvent.change(nameFeld(), { target: { value: 'Ein neues Lied' } });

    // Keine der Kategorien ist gedrückt – die App entscheidet nicht vor.
    for (const k of KATEGORIEN) {
      expect(screen.getByRole('button', { name: k.name }).getAttribute('aria-pressed')).toBe(
        'false',
      );
    }
    expect(screen.getByRole('button', { name: 'Lied anlegen' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('mit Name und Kategorie 0 gibt der Knopf frei – 0 ist eine echte Kategorie', () => {
    zeige();
    fireEvent.change(nameFeld(), { target: { value: 'Ein neues Lied' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aktive Songs' }));

    const knopf = screen.getByRole('button', { name: 'Lied anlegen' });
    expect(knopf.hasAttribute('disabled')).toBe(false);

    fireEvent.click(knopf);
    expect(anlegen).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ein neues Lied' }),
      0,
      null,
    );
  });

  it('ohne freigegebene Kategorie gibt es kein Formular, sondern eine Erklärung', () => {
    kategorien.mockReturnValue({ data: [], isLoading: false, isError: false });
    zeige();

    expect(screen.queryByPlaceholderText('Titel des Liedes')).toBeNull();
    expect(screen.getByText(/keine Lied-Kategorie zum Bearbeiten freigegeben/)).toBeTruthy();
  });

  it('auch ein SongSelect-Treffer muss durchs Formular – die Kategorie fehlt ihm', () => {
    /**
     * Der Grund, warum ein Treffer nicht direkt angelegt wird (#378): CCLI kennt keine
     * ChurchTools-Kategorie. Das Formular ist also kein Umweg, sondern die Stelle, an der die
     * Pflichtangabe entsteht.
     */
    caps.mockReturnValue(rechte(true));
    zeige({ startTreffer: TREFFER });

    expect(nameFeld().value).toBe('Treu');
    expect(screen.getByRole('button', { name: 'Lied anlegen' }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});

describe('NewSongSheet – ein Treffer füllt das Formular (#378)', () => {
  it('übernimmt Titel, Autoren, Nummer und Tonart', () => {
    caps.mockReturnValue(rechte(true));
    zeige({ startTreffer: TREFFER });

    expect(nameFeld().value).toBe('Treu');
    // Die Autoren stehen als eine Zeile im Feld – CCLI liefert sie als Liste.
    expect(screen.getByDisplayValue('Autor A, Autor B')).toBeTruthy();
    expect(screen.getByDisplayValue('5841527')).toBeTruthy();
    expect(screen.getByDisplayValue('E')).toBeTruthy();
  });

  it('holt das Copyright nach – es fehlt in der Trefferliste von CCLI', () => {
    caps.mockReturnValue(rechte(true));
    details.mockReturnValue({ data: VOLL, isLoading: false, isError: false });
    zeige({ startTreffer: TREFFER });

    expect(screen.getByDisplayValue('© 2019 Verlag')).toBeTruthy();
  });

  it('sagt beim Nachholen, dass das Copyright noch kommt', () => {
    caps.mockReturnValue(rechte(true));
    details.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    zeige({ startTreffer: TREFFER });

    expect(screen.getByPlaceholderText('Wird von SongSelect geholt …')).toBeTruthy();
  });

  it('fragt zur Nummer des Treffers ab', () => {
    caps.mockReturnValue(rechte(true));
    zeige({ startTreffer: TREFFER });
    expect(details).toHaveBeenCalledWith(5841527);
  });

  it('ohne Treffer wird gar nicht abgefragt – das leere Formular fragt nichts bei CCLI', () => {
    /**
     * Die Gegenprobe zum Nachholen: „Neues Lied" ohne Treffer ist der Weg für eigene Lieder und für
     * Gemeinden ohne Lizenz. Eine Abfrage bei CCLI wäre dort nicht nur unnötig, sondern ein Fehler.
     *
     * Geprüft wird das **Argument** – nur so kann der Test fehlschlagen, wenn die Abschaltung bricht.
     * Ein Blick auf den Ladehinweis hätte hier nur den Mock geprüft, nicht die Regel.
     */
    zeige();
    expect(details).toHaveBeenCalledWith(null);
    expect(nameFeld().value).toBe('');
  });
});

describe('NewSongSheet – gleicher Name', () => {
  it('warnt, sperrt aber nicht', () => {
    zeige();
    fireEvent.change(nameFeld(), { target: { value: 'Treu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aktive Songs' }));

    expect(screen.getByText(/gibt es schon/)).toBeTruthy();
    // Der Riegel gilt nur für die gleiche CCLI-Nummer, und den setzt der Server.
    expect(screen.getByRole('button', { name: 'Lied anlegen' }).hasAttribute('disabled')).toBe(
      false,
    );
  });
});

describe('NewSongSheet – Ablauf-Einstieg', () => {
  it('sagt vorher, dass das Lied in den Ablauf kommt', () => {
    zeige({ eventId: 42, eventName: 'Gottesdienst' });
    expect(screen.getByText(/in den Ablauf von Gottesdienst eingetragen/)).toBeTruthy();
  });
});

describe('NewSongSheet – „Selbst eintippen" belegt den Titel vor (04.09.2026)', () => {
  it('der Suchbegriff steht als Liedname im Formular', () => {
    zeige({ startName: 'Wo ich auch stehe' });
    expect(screen.getByPlaceholderText<HTMLInputElement>('Titel des Liedes').value).toBe(
      'Wo ich auch stehe',
    );
  });
});

describe('NewSongSheet – „Notenblatt schreiben/bearbeiten" nach dem Anlegen (04.09.2026)', () => {
  const ERGEBNIS = {
    songId: 77,
    arrangementId: 770,
    name: 'Wo ich auch stehe',
    notenblatt: false,
    notenblattQuelle: null,
    hinweise: [],
  };

  it('ohne Blatt heißt der Knopf „schreiben" und öffnet den Editor mit dem Gerüst – ohne Versionsname', async () => {
    hookErgebnis.mockReturnValue(ERGEBNIS);
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Notenblatt schreiben' }));

    expect((await screen.findByTestId('editor-text')).textContent).toContain(
      '{title: Wo ich auch stehe}',
    );
    // Das Original hat keinen Versionsnamen – das Feld wäre eine Frage ohne Antwort.
    expect(screen.getByTestId('editor-versionsname').textContent).toBe('false');
  });

  it('mit Blatt aus SongSelect heißt er „bearbeiten"', () => {
    hookErgebnis.mockReturnValue({ ...ERGEBNIS, notenblatt: true, notenblattQuelle: 'songselect' });
    zeige();
    expect(screen.getByRole('button', { name: 'Notenblatt bearbeiten' })).toBeTruthy();
    expect(screen.getByText(/mit Notenblatt aus SongSelect/)).toBeTruthy();
  });

  it('Speichern trifft den Hook und schließt den Editor', async () => {
    hookErgebnis.mockReturnValue(ERGEBNIS);
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Notenblatt schreiben' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Editor speichern' }));

    expect(notenblattSpeichern).toHaveBeenCalledWith('{title: Neu}\n[D]Text');
    await vi.waitFor(() => expect(screen.queryByTestId('editor-text')).toBeNull());
  });

  it('der Editor ist ein Angebot – nichts öffnet sich von selbst', () => {
    // Entscheidung Alwin: „nur als Option, nicht automatisch".
    hookErgebnis.mockReturnValue(ERGEBNIS);
    zeige();
    expect(screen.queryByTestId('editor-text')).toBeNull();
    expect(notenblattText).not.toHaveBeenCalled();
  });
});
