// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type {
  SongCategory,
  SongLibraryEntry,
  SongSelectSuchergebnis,
  UserCapabilities,
} from '@shared/types/index';

/**
 * Das Blatt „Neues Lied" (#322, Schritt 10b) – geprüft werden die **Entscheidungen**, nicht das
 * Aussehen:
 *
 *  - Die **Kategorie ist Pflicht ohne Vorbelegung** (Alwin, 13.08.2026): Ohne Wahl bleibt der Knopf
 *    gesperrt, und keine Kategorie ist beim Öffnen ausgewählt.
 *  - Ohne freigegebene Kategorie erscheint **kein Formular**, sondern ein ehrlicher Satz – sonst
 *    füllt jemand alles aus und ChurchTools lehnt am Ende ab.
 *  - Ohne SongSelect-Lizenz gibt es die **Wegwahl gar nicht**: Ein Weg, den es nicht gibt, wäre eine
 *    Sackgasse.
 *  - Gleicher Liedname **warnt**, blockiert aber nicht.
 */
const caps = vi.fn();
const kategorien = vi.fn();
const bibliothek = vi.fn();
const suche = vi.fn();
vi.mock('../hooks/useServices', () => ({
  SONGSELECT_MIN_ZEICHEN: 3,
  useCapabilities: () => caps(),
  useSongCategories: () => kategorien(),
  useSongLibrary: () => bibliothek(),
  useSongSelectSuche: () => suche(),
}));

const anlegen = vi.fn();
vi.mock('../hooks/useNeuesLied', () => ({
  useNeuesLied: () => ({
    anlegen,
    laeuft: false,
    fehler: null,
    ungewiss: false,
    ergebnis: null,
    zuruecksetzen: vi.fn(),
  }),
}));

const { NewSongSheet } = await import('./NewSongSheet');

const KATEGORIEN: SongCategory[] = [
  { id: 0, name: 'Aktive Songs' },
  { id: 1, name: 'Inaktive Songs' },
];

const BESTAND: SongLibraryEntry[] = [
  { songId: 3, name: 'Treu', author: null, key: null, arrangementId: 30 },
];

/**
 * **Typisiert, und das ist der Punkt** (13.08.2026): Der erste Entwurf mockte hier `{ data: [] }` – eine
 * Liste. Der Server liefert aber `{treffer, gesamt, vollstaendig}`. Weil Mock und Code dieselbe falsche
 * Annahme teilten, war der Test grün, während die App beim ersten echten Suchtreffer abstürzte
 * (`.map is not a function`). Mit dem geteilten Typ kann der Mock die Form nicht mehr erfinden.
 */
const LEERE_SUCHE: SongSelectSuchergebnis = { treffer: [], gesamt: 0, vollstaendig: true };

const SUCHE_MIT_TREFFERN: SongSelectSuchergebnis = {
  treffer: [
    {
      songNumber: 5841527,
      title: 'Treu',
      authors: ['Autor A'],
      defaultKey: 'E',
      isPublicDomain: false,
      hasLyrics: true,
      hasChordPro: true,
      hasChordSheet: true,
    },
  ],
  gesamt: 147,
  vollstaendig: false,
};

/** Nur die Felder, die dieses Blatt liest – der Rest der Rechte spielt hier keine Rolle. */
function rechte(canUseCcli: boolean): { data: Partial<UserCapabilities> } {
  return { data: { canUseCcli, canEditSongs: true } };
}

/**
 * Das Suchfeld über seinen Platzhalter – **einmal im Test benannt.** Der Wortlaut stand vorher dreimal
 * da; als er sich änderte („oder CCLI-Nummer"), fielen alle drei Tests einzeln auf.
 */
const suchfeld = () => screen.getByPlaceholderText(/Liedtitel/);

beforeEach(() => {
  vi.clearAllMocks();
  caps.mockReturnValue(rechte(false));
  kategorien.mockReturnValue({ data: KATEGORIEN, isLoading: false, isError: false });
  bibliothek.mockReturnValue({ data: BESTAND });
  suche.mockReturnValue({ data: LEERE_SUCHE, isLoading: false, isError: false });
});

function zeige(props: Partial<Parameters<typeof NewSongSheet>[0]> = {}) {
  return render(<NewSongSheet onClose={vi.fn()} {...props} />);
}

describe('NewSongSheet – Kategorie ist Pflicht', () => {
  it('keine Kategorie ist vorbelegt, und der Knopf bleibt gesperrt', () => {
    zeige();
    fireEvent.change(screen.getByPlaceholderText('Titel des Liedes'), {
      target: { value: 'Ein neues Lied' },
    });

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
    fireEvent.change(screen.getByPlaceholderText('Titel des Liedes'), {
      target: { value: 'Ein neues Lied' },
    });
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
});

describe('NewSongSheet – Wege', () => {
  it('ohne SongSelect-Lizenz beginnt das Blatt direkt beim Formular', () => {
    zeige();
    expect(screen.queryByRole('button', { name: /Bei CCLI suchen/ })).toBeNull();
    expect(screen.getByPlaceholderText('Titel des Liedes')).toBeTruthy();
  });

  it('mit Lizenz stehen beide Wege gleichrangig zur Wahl', () => {
    caps.mockReturnValue(rechte(true));
    zeige();
    expect(screen.getByRole('button', { name: /Bei CCLI suchen/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Selbst eintippen/ })).toBeTruthy();
  });

  it('unter drei Zeichen wird nicht bei CCLI gesucht', () => {
    caps.mockReturnValue(rechte(true));
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Bei CCLI suchen/ }));

    const knopf = () => screen.getByRole('button', { name: 'Suchen' });
    expect(knopf().hasAttribute('disabled')).toBe(true);
    fireEvent.change(suchfeld(), { target: { value: 'Tre' } });
    expect(knopf().hasAttribute('disabled')).toBe(false);
  });
});

describe('NewSongSheet – gleicher Name', () => {
  it('warnt, sperrt aber nicht', () => {
    zeige();
    fireEvent.change(screen.getByPlaceholderText('Titel des Liedes'), {
      target: { value: 'Treu' },
    });
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

describe('NewSongSheet – Trefferliste (Regression zum Absturz vom 13.08.2026)', () => {
  it('zeigt die Treffer aus `data.treffer` – nicht aus dem Antwort-Objekt selbst', () => {
    // Der Absturz: `.map` auf `{treffer, gesamt, vollstaendig}`. Dieser Test rendert die Liste wirklich.
    caps.mockReturnValue(rechte(true));
    suche.mockReturnValue({ data: SUCHE_MIT_TREFFERN, isLoading: false, isError: false });
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Bei CCLI suchen/ }));
    fireEvent.change(suchfeld(), { target: { value: 'Treu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));

    expect(screen.getByText('Treu')).toBeTruthy();
    expect(screen.getByText(/Nr. 5841527/)).toBeTruthy();
  });

  it('sagt mit den Zahlen DES SERVERS, dass die Liste unvollständig ist', () => {
    // Vorher stand hier ein geratenes `laenge >= 100` – dieselbe Rechnung ein zweites Mal.
    caps.mockReturnValue(rechte(true));
    suche.mockReturnValue({ data: SUCHE_MIT_TREFFERN, isLoading: false, isError: false });
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Bei CCLI suchen/ }));
    fireEvent.change(suchfeld(), { target: { value: 'Treu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));

    expect(screen.getByText(/147 Treffer/)).toBeTruthy();
  });

  it('schweigt, wenn der Server die Liste als vollständig meldet', () => {
    caps.mockReturnValue(rechte(true));
    suche.mockReturnValue({
      data: { ...SUCHE_MIT_TREFFERN, gesamt: 1, vollstaendig: true },
      isLoading: false,
      isError: false,
    });
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Bei CCLI suchen/ }));
    expect(screen.queryByText(/such genauer/)).toBeNull();
  });
});

describe('NewSongSheet – Titel oder CCLI-Nummer im selben Feld', () => {
  function zurSuche() {
    caps.mockReturnValue(rechte(true));
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Bei CCLI suchen/ }));
  }

  it('der Platzhalter nennt beide Wege – weil es beide wirklich gibt', () => {
    zurSuche();
    expect(screen.getByPlaceholderText('Liedtitel oder CCLI-Nummer eintippen …')).toBeTruthy();
  });

  it('bei reinen Ziffern heißt der Knopf „Abfragen"', () => {
    // Eine Nummer liefert genau ein Lied, keine Trefferliste – das darf der Knopf sagen.
    zurSuche();
    fireEvent.change(suchfeld(), { target: { value: 'Treu' } });
    expect(screen.getByRole('button', { name: 'Suchen' })).toBeTruthy();
    fireEvent.change(suchfeld(), { target: { value: '5841527' } });
    expect(screen.getByRole('button', { name: 'Abfragen' })).toBeTruthy();
  });

  it('bei einer unbekannten Nummer nennt der Hinweis den anderen Weg', () => {
    // „Nichts gefunden" allein würde jemanden ratlos zurücklassen, der sich vertippt hat.
    zurSuche();
    suche.mockReturnValue({ data: LEERE_SUCHE, isLoading: false, isError: false });
    fireEvent.change(suchfeld(), { target: { value: '9999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abfragen' }));

    const hinweis = screen.getByText(/9999999/);
    expect(hinweis.textContent).toContain('Tippe den Titel ein');
  });
});
