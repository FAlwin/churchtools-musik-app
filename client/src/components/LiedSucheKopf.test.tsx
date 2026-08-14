// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiedSucheKopf } from './LiedSucheKopf';
import type { LiedQuelle } from '../hooks/useLiedSuche';

/**
 * Der gemeinsame Suchkopf (#378) – ein Feld, darunter die Quellen.
 *
 * Geprüft wird, was der Nutzer **sieht und anfassen kann**: Sagt der Platzhalter, was die gewählte Quelle
 * versteht? Steht der Knopf nur dort, wo er nötig ist? Bleibt der Begriff beim Wechsel stehen?
 *
 * Der Platzhalter- und Knopf-Wortlaut stand vorher an mehreren Stellen im Test von `NewSongSheet`; als er
 * sich änderte („oder CCLI-Nummer", „Bei SongSelect suchen"), fielen alle einzeln auf. Deshalb hier
 * einmal benannt.
 */
const onEingabe = vi.fn();
const onQuelle = vi.fn();
const onJetztSuchen = vi.fn();

const ALLE: LiedQuelle[] = ['bibliothek', 'liedtext', 'songselect'];

beforeEach(() => vi.clearAllMocks());

function zeige(quelle: LiedQuelle, eingabe = '', quellen: LiedQuelle[] = ALLE) {
  return render(
    <LiedSucheKopf
      eingabe={eingabe}
      onEingabe={onEingabe}
      quelle={quelle}
      quellen={quellen}
      onQuelle={onQuelle}
      onJetztSuchen={onJetztSuchen}
    />,
  );
}

describe('LiedSucheKopf – der Platzhalter nennt die Quelle', () => {
  it('bei der Bibliothek: Lied oder Autor', () => {
    zeige('bibliothek');
    expect(screen.getByPlaceholderText('Lied oder Autor suchen…')).toBeTruthy();
  });

  it('bei den Liedtexten: ein Wort aus dem Text', () => {
    zeige('liedtext');
    expect(screen.getByPlaceholderText('Wort aus dem Liedtext…')).toBeTruthy();
  });

  it('bei SongSelect: beide Wege – weil es beide wirklich gibt', () => {
    zeige('songselect');
    expect(screen.getByPlaceholderText('Liedtitel oder CCLI-Nummer eintippen …')).toBeTruthy();
  });
});

describe('LiedSucheKopf – der Knopf steht nur bei SongSelect', () => {
  it('bei der Bibliothek gibt es keinen – sie filtert beim Tippen', () => {
    zeige('bibliothek', 'Gnade');
    expect(screen.queryByRole('button', { name: /Suchen|Abfragen/ })).toBeNull();
  });

  it('bei den Liedtexten auch nicht – die suchen entprellt von selbst', () => {
    zeige('liedtext', 'Gnade');
    expect(screen.queryByRole('button', { name: /Suchen|Abfragen/ })).toBeNull();
  });

  it('unter drei Zeichen bleibt er gesperrt', () => {
    zeige('songselect', 'Tr');
    expect(screen.getByRole('button', { name: 'Suchen' }).hasAttribute('disabled')).toBe(true);
  });

  it('ab drei Zeichen gibt er frei', () => {
    zeige('songselect', 'Tre');
    expect(screen.getByRole('button', { name: 'Suchen' }).hasAttribute('disabled')).toBe(false);
  });

  it('bei reinen Ziffern heißt er „Abfragen"', () => {
    // Eine Nummer liefert genau ein Lied, keine Trefferliste – das darf der Knopf sagen.
    zeige('songselect', '5841527');
    expect(screen.getByRole('button', { name: 'Abfragen' })).toBeTruthy();
  });

  it('löst beim Klick sofort aus – auch bei einer kurzen Nummer', () => {
    /**
     * Die Schwelle für die automatische Abfrage (7 Stellen, gemessen) ist eine Beobachtung an einem
     * Bestand, kein Gesetz von CCLI. Der Knopf muss sie übergehen können.
     */
    zeige('songselect', '1234');
    fireEvent.click(screen.getByRole('button', { name: 'Abfragen' }));
    expect(onJetztSuchen).toHaveBeenCalled();
  });

  it('die Eingabetaste löst bei SongSelect aus', () => {
    zeige('songselect', 'Treu');
    fireEvent.keyDown(screen.getByPlaceholderText(/Liedtitel/), { key: 'Enter' });
    expect(onJetztSuchen).toHaveBeenCalled();
  });

  it('die Eingabetaste löst in der Bibliothek NICHTS aus', () => {
    // Gegenprobe: Dort gibt es nichts abzuschicken, gefiltert wird schon beim Tippen.
    zeige('bibliothek', 'Treu');
    fireEvent.keyDown(screen.getByPlaceholderText(/Lied oder Autor/), { key: 'Enter' });
    expect(onJetztSuchen).not.toHaveBeenCalled();
  });
});

describe('LiedSucheKopf – der Umschalter', () => {
  it('zeigt die Reiter mit ihren Beschriftungen', () => {
    zeige('bibliothek');
    for (const name of ['Bibliothek', 'Liedtexte', 'SongSelect']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('meldet den Wechsel', () => {
    zeige('bibliothek');
    fireEvent.click(screen.getByRole('button', { name: 'Liedtexte' }));
    expect(onQuelle).toHaveBeenCalledWith('liedtext');
  });

  it('zeigt SongSelect nicht, wenn es die Quelle hier nicht gibt', () => {
    // Ohne Lizenz oder ohne Weg zum Anlegen – ein Reiter ins Leere wäre eine Sackgasse.
    zeige('bibliothek', '', ['bibliothek', 'liedtext']);
    expect(screen.queryByRole('button', { name: 'SongSelect' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Liedtexte' })).toBeTruthy();
  });

  it('verschwindet ganz, wenn nur eine Quelle bleibt', () => {
    zeige('bibliothek', '', ['bibliothek']);
    expect(screen.queryByRole('button', { name: 'Bibliothek' })).toBeNull();
  });

  it('der eingetippte Begriff bleibt beim Wechsel stehen – er gehört dem Nutzer', () => {
    const { rerender } = zeige('bibliothek', 'Gnade');
    rerender(
      <LiedSucheKopf
        eingabe="Gnade"
        onEingabe={onEingabe}
        quelle="songselect"
        quellen={ALLE}
        onQuelle={onQuelle}
        onJetztSuchen={onJetztSuchen}
      />,
    );
    // Generisch statt `as HTMLInputElement` – siehe die Begründung in `TempoMenu.test.tsx`.
    expect(screen.getByPlaceholderText<HTMLInputElement>(/Liedtitel/).value).toBe('Gnade');
  });
});
