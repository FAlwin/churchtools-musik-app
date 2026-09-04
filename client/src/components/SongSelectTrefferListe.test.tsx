// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SongSelectSuchergebnis } from '@shared/types/index';

/**
 * Die Trefferliste der Quelle „SongSelect" (#378) – **umgezogen aus `NewSongSheet.test.tsx`**, weil die
 * Suche dorthin nicht mehr gehört.
 *
 * Die wichtigste Zusicherung ist die **Regression zum Absturz vom 13.08.2026**: Der Server liefert
 * `{treffer, gesamt, vollstaendig}`, der Client hatte eine Liste erwartet und `.map` darauf laufen lassen.
 * `apiFetch<T>` prüft über die HTTP-Grenze nichts nach – der Typ ist dort eine Behauptung. Der damalige
 * Test war grün, weil **sein Mock dieselbe falsche Form hatte**; deshalb ist das Testmaterial hier gegen
 * den geteilten Typ typisiert.
 */
const suche = vi.fn();
vi.mock('../hooks/useServices', () => ({
  SONGSELECT_MIN_ZEICHEN: 3,
  useSongSelectSuche: () => suche(),
}));

const { SongSelectTrefferListe } = await import('./SongSelectTrefferListe');

const LEER: SongSelectSuchergebnis = { treffer: [], gesamt: 0, vollstaendig: true };

const MIT_TREFFERN: SongSelectSuchergebnis = {
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

const onVorschau = vi.fn();
const onEinfuegen = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  suche.mockReturnValue({ data: LEER, isLoading: false, isError: false });
});

function zeige(begriff: string) {
  return render(
    <SongSelectTrefferListe begriff={begriff} onVorschau={onVorschau} onEinfuegen={onEinfuegen} />,
  );
}

describe('SongSelectTrefferListe – Regression zum Absturz vom 13.08.2026', () => {
  it('zeigt die Treffer aus `data.treffer` – nicht aus dem Antwort-Objekt selbst', () => {
    suche.mockReturnValue({ data: MIT_TREFFERN, isLoading: false, isError: false });
    zeige('Treu');

    expect(screen.getByText('Treu')).toBeTruthy();
    expect(screen.getByText(/Nr. 5841527/)).toBeTruthy();
  });

  it('sagt mit den Zahlen DES SERVERS, dass die Liste unvollständig ist', () => {
    // Vorher stand hier ein geratenes `laenge >= 100` – dieselbe Rechnung ein zweites Mal und schlechter.
    suche.mockReturnValue({ data: MIT_TREFFERN, isLoading: false, isError: false });
    zeige('Treu');

    expect(screen.getByText(/147 Treffer/)).toBeTruthy();
  });

  it('schweigt, wenn der Server die Liste als vollständig meldet', () => {
    suche.mockReturnValue({
      data: { ...MIT_TREFFERN, gesamt: 1, vollstaendig: true },
      isLoading: false,
      isError: false,
    });
    zeige('Treu');

    expect(screen.queryByText(/such genauer/)).toBeNull();
  });
});

describe('SongSelectTrefferListe – Titel oder Nummer', () => {
  it('bei einer unbekannten Nummer nennt der Hinweis den anderen Weg', () => {
    // „Nichts gefunden" allein würde jemanden ratlos zurücklassen, der sich vertippt hat.
    zeige('9999999');

    const hinweis = screen.getByText(/9999999/);
    expect(hinweis.textContent).toContain('Tippe den Titel ein');
  });

  it('bei einem Titel ohne Treffer verweist der Hinweis auf „Neues Lied"', () => {
    zeige('Gibtsnicht');

    expect(screen.getByText(/eigenes Lied/)).toBeTruthy();
  });

  it('nennt beim Abfragen einer Nummer die Nummer im Ladehinweis', () => {
    suche.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    zeige('5841527');

    expect(screen.getByText(/CCLI-Nummer 5841527 wird bei SongSelect abgefragt/)).toBeTruthy();
  });
});

describe('SongSelectTrefferListe – Fehler', () => {
  it('zeigt die Meldung des Servers, statt sie zu erfinden', () => {
    // Fehlende Lizenz klingt anders als ein Aussetzer (#270) – den Unterschied kennt nur der Server.
    suche.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('SongSelect ist für diese Gemeinde nicht freigeschaltet.'),
    });
    zeige('Treu');

    expect(screen.getByText(/nicht freigeschaltet/)).toBeTruthy();
  });
});

describe('SongSelectTrefferListe – zwei Knöpfe je Zeile (04.09.2026)', () => {
  it('die Zeile öffnet die Vorschau – und gibt den ganzen Treffer weiter', () => {
    suche.mockReturnValue({ data: MIT_TREFFERN, isLoading: false, isError: false });
    zeige('Treu');
    // Über die Unterzeile benannt: Der Titel steht auch im Vorlesetext des Plus-Knopfs.
    fireEvent.click(screen.getByRole('button', { name: /Autor A/ }));

    expect(onVorschau).toHaveBeenCalledWith(MIT_TREFFERN.treffer[0]);
    expect(onEinfuegen).not.toHaveBeenCalled();
  });

  it('das Plus geht direkt zum Anlegen – ohne Vorschau', () => {
    // Das Formular braucht mehr als den Titel, deshalb der ganze Treffer.
    suche.mockReturnValue({ data: MIT_TREFFERN, isLoading: false, isError: false });
    zeige('Treu');
    fireEvent.click(screen.getByRole('button', { name: /ohne Vorschau hinzufügen/ }));

    expect(onEinfuegen).toHaveBeenCalledWith(MIT_TREFFERN.treffer[0]);
    expect(onVorschau).not.toHaveBeenCalled();
  });

  it('die Gruppe ist beschriftet – ein CCLI-Treffer sieht einem eigenen Lied sonst zum Verwechseln ähnlich', () => {
    suche.mockReturnValue({ data: MIT_TREFFERN, isLoading: false, isError: false });
    zeige('Treu');
    expect(screen.getByText(/SongSelect · 1 Treffer zu „Treu"/)).toBeTruthy();
  });
});
