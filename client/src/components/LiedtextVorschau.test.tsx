// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LiedtextVorschau as LiedtextVorschauAntwort } from '@shared/types/index';

/**
 * Die Liedtext-Vorschau (#379) – **auf Verlangen je Lied.**
 *
 * Die teuerste Zusicherung steht zuerst: **Solange niemand „Text zeigen" antippt, wird nicht abgefragt.**
 * Eine Vorschau je Listenzeile hieße eine Anfrage je Zeile – bei 49 Liedern also 49, nur um eine Liste
 * durchzusehen. Geprüft wird das am **`enabled`-Argument**, nicht an der Darstellung: Sonst prüfte der
 * Test nur den Mock.
 *
 * Dazu die Fälle, die man leicht verwechselt: „kein Liedtext vorhanden" (`vorschau: null`) ist etwas
 * anderes als ein **Fehler** – und beides etwas anderes als eine leere Vorschau, die nach einem
 * Ladeproblem aussieht.
 */
const vorschau = vi.fn();
vi.mock('../hooks/useServices', () => ({
  useLiedtextVorschau: (songId: number, enabled: boolean) => vorschau(songId, enabled),
}));

const { LiedtextVorschau } = await import('./LiedtextVorschau');

const MIT_TEXT: LiedtextVorschauAntwort = {
  vorschau: 'Ich bin geliebt und frei, du trägst mich …',
};
const OHNE_TEXT: LiedtextVorschauAntwort = { vorschau: null };

beforeEach(() => {
  vi.clearAllMocks();
  vorschau.mockReturnValue({ data: undefined, isLoading: false, isError: false });
});

function zeige() {
  return render(<LiedtextVorschau songId={7} songName="Treu" />);
}

const zeigenKnopf = () => screen.getByRole('button', { name: /Liedtext-Anfang von „Treu" zeigen/ });

describe('LiedtextVorschau – ohne Antippen keine Anfrage', () => {
  it('fragt beim Anzeigen der Liste NICHT ab', () => {
    zeige();
    expect(vorschau).toHaveBeenCalledWith(7, false);
  });

  it('zeigt nur einen Knopf, keinen Text', () => {
    zeige();
    expect(zeigenKnopf()).toBeTruthy();
    expect(screen.queryByText(/geliebt/)).toBeNull();
  });

  it('erst der Klick schaltet die Abfrage frei', () => {
    zeige();
    fireEvent.click(zeigenKnopf());
    expect(vorschau).toHaveBeenLastCalledWith(7, true);
  });
});

describe('LiedtextVorschau – was angezeigt wird', () => {
  it('den Textanfang, wenn einer da ist', () => {
    vorschau.mockReturnValue({ data: MIT_TEXT, isLoading: false, isError: false });
    zeige();
    fireEvent.click(zeigenKnopf());

    expect(screen.getByText(/Ich bin geliebt und frei/)).toBeTruthy();
  });

  it('einen ruhigen Satz, wenn das Lied keinen Text hat – NICHT eine leere Vorschau', () => {
    /**
     * `vorschau: null` ist ein gültiger Fall (Lied ohne Notenblatt), kein Fehler. Nichts anzuzeigen
     * würde wie ein hängender Ladevorgang aussehen.
     */
    vorschau.mockReturnValue({ data: OHNE_TEXT, isLoading: false, isError: false });
    zeige();
    fireEvent.click(zeigenKnopf());

    expect(screen.getByText(/kein Liedtext vor/)).toBeTruthy();
  });

  it('während des Holens einen Hinweis', () => {
    vorschau.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    zeige();
    fireEvent.click(zeigenKnopf());

    expect(screen.getByText(/wird geholt/)).toBeTruthy();
  });

  it('bei einem Fehler die Meldung des Servers – nicht eine erfundene', () => {
    // „ChurchTools bremst uns aus" ist etwas anderes als „kein Text" (#270).
    vorschau.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('ChurchTools bremst uns aus. Bitte in 2 Minuten erneut versuchen.'),
    });
    zeige();
    fireEvent.click(zeigenKnopf());

    expect(screen.getByText(/bremst uns aus/)).toBeTruthy();
    expect(screen.queryByText(/kein Liedtext vor/)).toBeNull();
  });

  it('lässt sich wieder ausblenden', () => {
    vorschau.mockReturnValue({ data: MIT_TEXT, isLoading: false, isError: false });
    zeige();
    fireEvent.click(zeigenKnopf());
    fireEvent.click(screen.getByRole('button', { name: /ausblenden/ }));

    expect(screen.queryByText(/Ich bin geliebt/)).toBeNull();
    expect(zeigenKnopf()).toBeTruthy();
  });
});

describe('LiedtextVorschau – der Klick gehört der Vorschau', () => {
  it('reicht ihn NICHT an die Zeile darunter weiter', () => {
    /**
     * In allen drei Listen liegt die Vorschau neben einem Knopf, der das Lied öffnet. Ohne
     * `stopPropagation` würde „Text zeigen" in manchen Anordnungen das Lied öffnen – also genau das
     * Gegenteil dessen, was man wollte.
     */
    const aufZeile = vi.fn();
    render(
      <div onClick={aufZeile}>
        <LiedtextVorschau songId={7} songName="Treu" />
      </div>,
    );
    fireEvent.click(zeigenKnopf());

    expect(aufZeile).not.toHaveBeenCalled();
  });
});
