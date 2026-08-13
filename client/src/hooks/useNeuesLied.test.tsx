// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SongSelectTreffer } from '@shared/types/index';

/**
 * Der Ablauf „Lied anlegen" (#322, Schritt 10b) – geprüft wird das, was man nicht sieht.
 *
 * Drei Regeln, jede für sich:
 *  1. **Ein Fehlschlag beim Notenblatt macht das Lied nicht ungültig.** Es existiert in ChurchTools;
 *     wer hier „fehlgeschlagen" meldete, würde zum zweiten Versuch einladen – und ein zweites Lied
 *     anlegen.
 *  2. **Ein misslungener Ablauf-Eintrag wird benannt.** Sonst sucht jemand das Lied im Ablauf umsonst.
 *  3. **Nach einem `502` ist der Zustand ungewiss.** `schreibe()` meldet 502 sowohl für „ChurchTools
 *     hat abgelehnt" (nichts entstanden) als auch für „Lied da, aber kein Arrangement". Deshalb darf
 *     der Knopf nicht einfach „Erneut versuchen" heißen.
 */
const legeLiedAn = vi.fn();
const holeChordProAusSongSelect = vi.fn();
vi.mock('../services/churchtoolsApi', () => ({
  legeLiedAn: (...a: unknown[]) => legeLiedAn(...a),
  holeChordProAusSongSelect: (...a: unknown[]) => holeChordProAusSongSelect(...a),
}));

const { ApiError } = await import('../services/api');
const { useNeuesLied } = await import('./useNeuesLied');
const { LEERES_FORMULAR } = await import('../utils/neuesLied');

const TREFFER: SongSelectTreffer = {
  songNumber: 5841527,
  title: 'Treu',
  authors: ['Autor A'],
  defaultKey: 'E',
  isPublicDomain: false,
  hasLyrics: true,
  hasChordPro: true,
  hasChordSheet: true,
};

const FORMULAR = { ...LEERES_FORMULAR, name: 'Treu', categoryId: 0, ccli: '5841527', key: 'E' };

function starte(opts: { eventId?: number; canUseCcli?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(
    () => useNeuesLied({ eventId: opts.eventId, canUseCcli: opts.canUseCcli ?? true }),
    {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  legeLiedAn.mockResolvedValue({ songId: 77, arrangementId: 500 });
  holeChordProAusSongSelect.mockResolvedValue([]);
});

describe('useNeuesLied – der gute Fall', () => {
  it('legt an, holt das Notenblatt und meldet keine Einschränkung', async () => {
    const { result } = starte();
    await result.current.anlegen(FORMULAR, 0, TREFFER);

    await waitFor(() => expect(result.current.ergebnis).not.toBeNull());
    expect(legeLiedAn).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Treu', categoryId: 0, ccli: '5841527' }),
    );
    expect(holeChordProAusSongSelect).toHaveBeenCalledWith(77, 500, 5841527);
    expect(result.current.ergebnis?.notenblatt).toBe(true);
    expect(result.current.ergebnis?.hinweise).toEqual([]);
    expect(result.current.fehler).toBeNull();
  });

  it('trägt den Termin in den Auftrag ein, statt danach ein zweites Mal zu schreiben', async () => {
    // Der Ablauf-Eintrag gehört zum Auftrag: So kennt der Server die Reihenfolge und kann den
    // Teilerfolg melden. Ein eigener Aufruf hier hätte den Punkt doppelt eingetragen.
    legeLiedAn.mockResolvedValue({ songId: 77, arrangementId: 500, imAblauf: true });
    const { result } = starte({ eventId: 42 });
    await result.current.anlegen(FORMULAR, 0, TREFFER);

    await waitFor(() => expect(result.current.ergebnis).not.toBeNull());
    expect(legeLiedAn).toHaveBeenCalledWith(expect.objectContaining({ eventId: 42 }));
    expect(result.current.ergebnis?.hinweise).toEqual([]);
  });
});

describe('useNeuesLied – Teilerfolge', () => {
  it('das Lied bleibt gültig, wenn das Notenblatt nicht kommt', async () => {
    holeChordProAusSongSelect.mockRejectedValue(new Error('CCLI antwortet nicht.'));
    const { result } = starte();
    await result.current.anlegen(FORMULAR, 0, TREFFER);

    await waitFor(() => expect(result.current.ergebnis).not.toBeNull());
    // Das ist der Kern: Es gibt ein Ergebnis (songId!), nur ohne Blatt – und der Grund steht dabei.
    expect(result.current.ergebnis?.songId).toBe(77);
    expect(result.current.ergebnis?.notenblatt).toBe(false);
    expect(result.current.ergebnis?.hinweise.join(' ')).toContain('CCLI antwortet nicht.');
    expect(result.current.fehler).toBeNull();
  });

  it('nennt einen misslungenen Ablauf-Eintrag samt Grund', async () => {
    legeLiedAn.mockResolvedValue({
      songId: 77,
      arrangementId: 500,
      imAblauf: false,
      ablaufFehler: 'Keine Berechtigung, den Ablauf zu ändern.',
    });
    const { result } = starte({ eventId: 42 });
    await result.current.anlegen(FORMULAR, 0, TREFFER);

    await waitFor(() => expect(result.current.ergebnis).not.toBeNull());
    const hinweise = result.current.ergebnis?.hinweise.join(' ') ?? '';
    expect(hinweise).toContain('noch nicht im Ablauf');
    expect(hinweise).toContain('Keine Berechtigung');
  });

  it('sagt ohne Akkorde bei CCLI Bescheid, statt es zu versuchen', async () => {
    const { result } = starte();
    await result.current.anlegen(FORMULAR, 0, { ...TREFFER, hasChordPro: false });

    await waitFor(() => expect(result.current.ergebnis).not.toBeNull());
    expect(holeChordProAusSongSelect).not.toHaveBeenCalled();
    expect(result.current.ergebnis?.hinweise.join(' ')).toContain('keine Akkorde');
  });

  it('holt ohne SongSelect-Lizenz nichts und behauptet auch nichts', async () => {
    const { result } = starte({ canUseCcli: false });
    await result.current.anlegen(FORMULAR, 0, null);

    await waitFor(() => expect(result.current.ergebnis).not.toBeNull());
    expect(holeChordProAusSongSelect).not.toHaveBeenCalled();
    expect(result.current.ergebnis?.hinweise).toEqual([]);
    expect(result.current.ergebnis?.notenblatt).toBe(false);
  });
});

describe('useNeuesLied – Fehlschläge', () => {
  it('nach einem 502 gilt der Zustand als ungewiss', async () => {
    legeLiedAn.mockRejectedValue(
      new ApiError(502, '„Treu" wurde angelegt, aber ohne Arrangement.'),
    );
    const { result } = starte();
    await result.current.anlegen(FORMULAR, 0, TREFFER);

    await waitFor(() => expect(result.current.fehler).not.toBeNull());
    expect(result.current.ungewiss).toBe(true);
    expect(result.current.ergebnis).toBeNull();
    expect(result.current.fehler).toContain('ohne Arrangement');
  });

  it('eine abgelehnte Doppel-Nummer (409) ist NICHT ungewiss', async () => {
    // Hier ist sicher nichts entstanden – der Nutzer darf den Namen ändern und normal weitermachen.
    legeLiedAn.mockRejectedValue(new ApiError(409, 'Die CCLI-Nummer 5841527 hat schon „Treu".'));
    const { result } = starte();
    await result.current.anlegen(FORMULAR, 0, TREFFER);

    await waitFor(() => expect(result.current.fehler).not.toBeNull());
    expect(result.current.ungewiss).toBe(false);
    expect(result.current.fehler).toContain('CCLI-Nummer');
  });

  it('holt kein Notenblatt, wenn das Anlegen scheitert', async () => {
    legeLiedAn.mockRejectedValue(new ApiError(403, 'abgelehnt'));
    const { result } = starte();
    await result.current.anlegen(FORMULAR, 0, TREFFER);

    await waitFor(() => expect(result.current.fehler).not.toBeNull());
    expect(holeChordProAusSongSelect).not.toHaveBeenCalled();
  });

  it('zuruecksetzen räumt Fehler, Ungewissheit und Ergebnis weg', async () => {
    legeLiedAn.mockRejectedValue(new ApiError(502, 'kaputt'));
    const { result } = starte();
    await result.current.anlegen(FORMULAR, 0, TREFFER);
    await waitFor(() => expect(result.current.ungewiss).toBe(true));

    result.current.zuruecksetzen();
    await waitFor(() => expect(result.current.fehler).toBeNull());
    expect(result.current.ungewiss).toBe(false);
    expect(result.current.ergebnis).toBeNull();
  });
});
