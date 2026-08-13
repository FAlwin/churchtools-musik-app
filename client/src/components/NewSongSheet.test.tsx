// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SongCategory, SongLibraryEntry, UserCapabilities } from '@shared/types/index';

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

/** Nur die Felder, die dieses Blatt liest – der Rest der Rechte spielt hier keine Rolle. */
function rechte(canUseCcli: boolean): { data: Partial<UserCapabilities> } {
  return { data: { canUseCcli, canEditSongs: true } };
}

beforeEach(() => {
  vi.clearAllMocks();
  caps.mockReturnValue(rechte(false));
  kategorien.mockReturnValue({ data: KATEGORIEN, isLoading: false, isError: false });
  bibliothek.mockReturnValue({ data: BESTAND });
  suche.mockReturnValue({ data: [], isLoading: false, isError: false });
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
    fireEvent.change(screen.getByPlaceholderText('Liedtitel …'), { target: { value: 'Tre' } });
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
