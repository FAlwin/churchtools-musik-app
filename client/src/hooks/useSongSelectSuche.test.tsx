// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SongSelectSong, SongSelectSuchergebnis } from '@shared/types/index';

/**
 * Titel **oder** CCLI-Nummer im selben Feld (#322).
 *
 * Zwei verschiedene Wege bei CCLI, und die Unterscheidung ist der Kern: Der Titel geht in die unscharfe
 * Suche (147 Treffer für „Wo ich auch stehe"), reine Ziffern gehen direkt an die Nummer-Abfrage – **ein**
 * Treffer, sofort richtig. Geprüft wird deshalb, **welcher Endpunkt** gerufen wird, denn am Ergebnis ist
 * das nicht mehr abzulesen: Beide liefern dieselbe Form.
 */
const sucheSongSelect = vi.fn();
const getSongSelectSong = vi.fn();
vi.mock('../services/churchtoolsApi', () => ({
  sucheSongSelect: (...a: unknown[]) => sucheSongSelect(...a),
  getSongSelectSong: (...a: unknown[]) => getSongSelectSong(...a),
}));

const { useSongSelectSuche } = await import('./useServices');

const LIED: SongSelectSong = {
  songNumber: 5841527,
  title: 'Treu',
  authors: ['Autor A'],
  defaultKey: 'E',
  isPublicDomain: false,
  hasLyrics: true,
  hasChordPro: true,
  hasChordSheet: true,
  copyright: '2019 Beispielverlag',
};

const TITELSUCHE: SongSelectSuchergebnis = { treffer: [LIED], gesamt: 147, vollstaendig: false };

function starte(eingabe: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useSongSelectSuche(eingabe, true), {
    wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sucheSongSelect.mockResolvedValue(TITELSUCHE);
  getSongSelectSong.mockResolvedValue(LIED);
});

describe('useSongSelectSuche', () => {
  it('sucht bei einem Titel nach dem Namen', async () => {
    const { result } = starte('Treu');
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(sucheSongSelect).toHaveBeenCalledWith('Treu');
    expect(getSongSelectSong).not.toHaveBeenCalled();
    expect(result.current.data?.gesamt).toBe(147);
  });

  it('fragt bei reinen Ziffern die CCLI-Nummer ab', async () => {
    const { result } = starte('5841527');
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(getSongSelectSong).toHaveBeenCalledWith(5841527);
    expect(sucheSongSelect).not.toHaveBeenCalled();
  });

  it('bringt die Nummer-Abfrage in dieselbe Form – ein Treffer, vollständig', async () => {
    // Damit die Trefferliste nicht zwei Fälle kennen muss.
    const { result } = starte('5841527');
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data).toEqual({ treffer: [LIED], gesamt: 1, vollstaendig: true });
  });

  it('fragt unter drei Zeichen gar nicht', () => {
    starte('58');
    expect(sucheSongSelect).not.toHaveBeenCalled();
    expect(getSongSelectSong).not.toHaveBeenCalled();
  });

  it('hält „Psalm 23" für einen Titel', async () => {
    const { result } = starte('Psalm 23');
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(sucheSongSelect).toHaveBeenCalledWith('Psalm 23');
  });

  it('trennt Titel und Nummer im Cache-Schlüssel', async () => {
    // Sonst käme für „5841527" das Ergebnis einer gleichlautenden Titelsuche aus dem Zwischenspeicher.
    const eins = starte('5841527');
    await waitFor(() => expect(eins.result.current.data).toBeTruthy());
    expect(getSongSelectSong).toHaveBeenCalledTimes(1);
    expect(sucheSongSelect).toHaveBeenCalledTimes(0);
  });
});
