// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Der gemeinsame Notenblatt-Hook (04.09.2026) – für „Neues Lied" UND „Stammdaten ändern".
 *
 * Geprüft wird, woher der Starttext kommt und was Speichern tut. Die Fälle mit Ergebnis-Nachziehen
 * stehen in `useNeuesLied.test.tsx`; hier nur die Mechanik, die beide teilen.
 */
const speichereNotenblatt = vi.fn();
const getSongChart = vi.fn();
vi.mock('../services/churchtoolsApi', () => ({
  speichereNotenblatt: (...a: unknown[]) => speichereNotenblatt(...a),
  getSongChart: (...a: unknown[]) => getSongChart(...a),
}));

const { useNotenblatt } = await import('./useNotenblatt');

const ZIEL = { songId: 77, arrangementId: 500 };
const VORLAGE = { title: 'Treu', key: 'E', ccli: '5841527' };

function starte(ziel: typeof ZIEL | null = ZIEL) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  const hook = renderHook(() => useNotenblatt(ziel), {
    wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  });
  return { ...hook, invalidate };
}

beforeEach(() => {
  vi.clearAllMocks();
  speichereNotenblatt.mockResolvedValue([]);
  getSongChart.mockResolvedValue({ chordpro: '{title: Treu}\n[E]Vorhanden' });
});

describe('useNotenblatt – der Starttext', () => {
  it('ohne Blatt (bekannt) kommt das Gerüst – und das Blatt wird NICHT abgefragt', async () => {
    const { result } = starte();
    const text = await result.current.text(VORLAGE, false);
    expect(text).toContain('{title: Treu}');
    expect(text).toContain('{key: E}');
    expect(text).toContain('{ccli: 5841527}');
    expect(getSongChart).not.toHaveBeenCalled();
  });

  it('mit Blatt kommt genau dieses', async () => {
    const { result } = starte();
    expect(await result.current.text(VORLAGE, true)).toBe('{title: Treu}\n[E]Vorhanden');
    expect(getSongChart).toHaveBeenCalledWith(77, 500);
  });

  it('unbekannt (Stammdaten-Blatt): nachsehen – leer heißt Gerüst', async () => {
    // Das Stammdaten-Blatt weiß nicht, ob ein Blatt existiert. `null` = nachsehen.
    getSongChart.mockResolvedValue({ chordpro: '' });
    const { result } = starte();
    const text = await result.current.text(VORLAGE, null);
    expect(getSongChart).toHaveBeenCalledTimes(1);
    expect(text).toContain('{title: Treu}');
  });

  it('ohne Ziel gibt es nichts – und keinen Aufruf', async () => {
    const { result } = starte(null);
    expect(await result.current.text(VORLAGE, null)).toBe('');
    expect(getSongChart).not.toHaveBeenCalled();
  });
});

describe('useNotenblatt – Speichern', () => {
  it('schreibt das Original und verwirft den Chart-Cache dieses Liedes', async () => {
    const { result, invalidate } = starte();
    expect(await result.current.speichern('{title: Treu}\n[E]Neu')).toBe(true);
    expect(speichereNotenblatt).toHaveBeenCalledWith(77, 500, '{title: Treu}\n[E]Neu');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['song-chart', 77] });
    expect(result.current.fehler).toBeNull();
  });

  it('ein Fehlschlag nennt den Grund vom Server und meldet false', async () => {
    speichereNotenblatt.mockRejectedValue(
      new Error('Keine Berechtigung, Dateien in ChurchTools zu speichern.'),
    );
    const { result } = starte();
    expect(await result.current.speichern('x')).toBe(false);
    await waitFor(() => expect(result.current.fehler).toContain('Keine Berechtigung'));
  });

  it('ohne Ziel wird nichts geschrieben', async () => {
    const { result } = starte(null);
    expect(await result.current.speichern('x')).toBe(false);
    expect(speichereNotenblatt).not.toHaveBeenCalled();
  });
});
