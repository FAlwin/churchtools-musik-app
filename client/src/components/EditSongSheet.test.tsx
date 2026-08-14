// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { LiedStammdatenAnsicht, SongCategory, SongLibraryEntry } from '@shared/types/index';

/**
 * „Stammdaten ändern" (#322, Schritt 11) – geprüft werden die **Entscheidungen**:
 *
 *  - **Nur Geändertes wird geschickt.** Der Server ergänzt daraus den vollständigen `PUT`; die
 *    Oberfläche darf aber nicht mehr behaupten, als der Nutzer angefasst hat.
 *  - **Ohne Änderung bleibt der Knopf gesperrt** – ein Schreibvorgang für nichts wäre eine
 *    ChurchTools-Anfrage ohne Wirkung.
 *  - **Löschen fragt vorher und nennt die Folgen.** Alwins Entscheidung: löschen ja, aber nicht
 *    beiläufig.
 *  - **Ohne Kategorie kein Formular:** ChurchTools verlangt sie beim `PUT`, ein Speichern würde sicher
 *    scheitern.
 */
const stammdaten = vi.fn();
const kategorien = vi.fn();
const bibliothek = vi.fn();
const aendernFn = vi.fn();
const loeschenFn = vi.fn();
vi.mock('../hooks/useServices', () => ({
  useSongStammdaten: () => stammdaten(),
  useSongCategories: () => kategorien(),
  useSongLibrary: () => bibliothek(),
  useLiedAendern: () => ({ mutateAsync: aendernFn, isPending: false }),
  useLiedLoeschen: () => ({ mutateAsync: loeschenFn, isPending: false }),
}));

const { EditSongSheet } = await import('./EditSongSheet');

const KATEGORIEN: SongCategory[] = [
  { id: 0, name: 'Aktive Songs' },
  { id: 1, name: 'Inaktive Songs' },
];

const IST: LiedStammdatenAnsicht = {
  songId: 7,
  name: 'Treu',
  author: 'Autor A',
  ccli: '5841527',
  copyright: '2019 Beispielverlag',
  categoryId: 0,
};

const BESTAND: SongLibraryEntry[] = [
  { songId: 7, name: 'Treu', author: null, key: null, arrangementId: 70 },
];

beforeEach(() => {
  vi.clearAllMocks();
  stammdaten.mockReturnValue({ data: IST, isError: false });
  kategorien.mockReturnValue({ data: KATEGORIEN, isLoading: false, isError: false });
  bibliothek.mockReturnValue({ data: BESTAND });
  aendernFn.mockResolvedValue(IST);
  loeschenFn.mockResolvedValue({ name: 'Treu' });
});

function zeige(props: Partial<Parameters<typeof EditSongSheet>[0]> = {}) {
  return render(<EditSongSheet songId={7} onClose={vi.fn()} {...props} />);
}

const speichernKnopf = () => screen.getByRole('button', { name: 'Speichern' });

describe('EditSongSheet – nur Geändertes schicken', () => {
  it('ohne Änderung ist Speichern gesperrt', () => {
    zeige();
    expect(speichernKnopf().hasAttribute('disabled')).toBe(true);
  });

  it('schickt nur das geänderte Feld', async () => {
    zeige();
    fireEvent.change(screen.getByPlaceholderText('Titel des Liedes'), {
      target: { value: 'Treu (neu)' },
    });
    expect(speichernKnopf().hasAttribute('disabled')).toBe(false);

    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(aendernFn).toHaveBeenCalledWith({ name: 'Treu (neu)' }));
  });

  it('ein geleertes Feld wird als Leerung geschickt', async () => {
    zeige();
    const autor = screen.getByDisplayValue('Autor A');
    fireEvent.change(autor, { target: { value: '' } });
    fireEvent.click(speichernKnopf());
    await waitFor(() => expect(aendernFn).toHaveBeenCalledWith({ author: '' }));
  });

  it('zeigt die Meldung des Servers und schließt NICHT', async () => {
    // Die Eingaben müssen stehen bleiben: Vielleicht war es nur die CCLI-Nummer (#270).
    aendernFn.mockRejectedValue(new Error('Die CCLI-Nummer 5841527 hat schon „Anderes".'));
    const onClose = vi.fn();
    zeige({ onClose });
    fireEvent.change(screen.getByPlaceholderText('Titel des Liedes'), {
      target: { value: 'Treu (neu)' },
    });
    fireEvent.click(speichernKnopf());

    await waitFor(() => expect(screen.getByText(/hat schon/)).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Treu (neu)')).toBeTruthy();
  });
});

describe('EditSongSheet – Löschen', () => {
  it('fragt vorher und nennt die Folgen', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Lied löschen/ }));

    expect(screen.getByText('Lied löschen?')).toBeTruthy();
    const frage = screen.getByText(/wird in ChurchTools gelöscht/);
    // Die Folgen ausdrücklich – nicht bloß „wirklich?".
    expect(frage.textContent).toContain('Arrangements');
    expect(frage.textContent).toContain('Notenblättern');
    expect(frage.textContent).toContain('Ablauf');
    // Und noch ist nichts passiert.
    expect(loeschenFn).not.toHaveBeenCalled();
  });

  it('löscht erst nach der Bestätigung und meldet es mit Namen', async () => {
    const onDeleted = vi.fn();
    zeige({ onDeleted });
    fireEvent.click(screen.getByRole('button', { name: /Lied löschen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(loeschenFn).toHaveBeenCalledWith(7));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('„Treu" wurde gelöscht.'));
  });

  it('Abbrechen löscht nichts', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: /Lied löschen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(loeschenFn).not.toHaveBeenCalled();
  });
});

describe('EditSongSheet – Sonderfälle', () => {
  it('warnt nicht wegen des eigenen Namens', () => {
    zeige();
    expect(screen.queryByText(/gibt es schon/)).toBeNull();
  });

  it('ohne Kategorie in ChurchTools gibt es kein Formular', () => {
    stammdaten.mockReturnValue({ data: { ...IST, categoryId: null }, isError: false });
    zeige();
    expect(screen.queryByPlaceholderText('Titel des Liedes')).toBeNull();
    expect(screen.getByText(/keine Kategorie/)).toBeTruthy();
  });

  it('benennt einen Fehlschlag beim Laden, statt ein leeres Formular zu zeigen', () => {
    stammdaten.mockReturnValue({ data: undefined, isError: true, refetch: vi.fn() });
    zeige();
    expect(screen.getByText(/konnten nicht geladen werden/)).toBeTruthy();
  });
});
