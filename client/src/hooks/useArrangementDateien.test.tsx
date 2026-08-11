// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ArrangementFileEntry } from '@shared/types/index';

/**
 * #321, Schritt 4.
 *
 * **Der Grund für diese Datei ist EIN Fehler, der mir beim Durchklicken auffiel und den keine
 * Testsuite gemeldet hätte:** Stand vor der Erfolgsmeldung ein `await` auf `invalidateQueries`, blieb
 * nach einem erfolgreichen Löschen **jede Rückmeldung aus**. Gilt der Server als unerreichbar, hält
 * React Query das Nachladen an – das Versprechen wird dann nie erfüllt, der `await` hängt für immer,
 * und die Zeile mit der Meldung wird nie erreicht. Der Nutzer sieht: nichts. Und weiß nicht, ob seine
 * Datei weg ist.
 *
 * Deshalb wird hier mit einem **nie erfüllten** `invalidateQueries` geprüft: Die Meldung muss trotzdem
 * kommen. Das ist gleichzeitig die Gegenprobe – mit `await` fällt der Test.
 */
const getArrangementFiles = vi.fn();
const uploadArrangementFile = vi.fn();
const deleteSongFile = vi.fn();
const getSongFileBlob = vi.fn();
vi.mock('../services/churchtoolsApi', () => ({
  getArrangementFiles: (...a: unknown[]) => getArrangementFiles(...a),
  uploadArrangementFile: (...a: unknown[]) => uploadArrangementFile(...a),
  deleteSongFile: (...a: unknown[]) => deleteSongFile(...a),
  getSongFileBlob: (...a: unknown[]) => getSongFileBlob(...a),
}));
const shareOrDownload = vi.fn();
vi.mock('../utils/shareFile', () => ({
  shareOrDownload: (...a: unknown[]) => shareOrDownload(...a),
}));

const { useArrangementDateien } = await import('./useArrangementDateien');

const PDF: ArrangementFileEntry = {
  fileId: 2,
  name: 'Treu - E.pdf',
  label: 'Treu - E.pdf',
  size: 1024,
  kind: 'pdf',
};
const LISTE: ArrangementFileEntry[] = [PDF];

function starte(opts: { invalidateHaengt?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (opts.invalidateHaengt) {
    // Genau der gemessene Zustand: React Query hält das Nachladen an, das Versprechen wird nie erfüllt.
    qc.invalidateQueries = () => new Promise<void>(() => undefined);
  }
  const showToast = vi.fn();
  const onReload = vi.fn();
  const view = renderHook(
    () =>
      useArrangementDateien({
        songId: 12,
        arrangementId: 500,
        aktiv: true,
        showToast,
        onReload,
      }),
    {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    },
  );
  return { ...view, showToast, onReload };
}

beforeEach(() => {
  getArrangementFiles.mockResolvedValue(LISTE);
  uploadArrangementFile.mockResolvedValue(LISTE);
  deleteSongFile.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe('useArrangementDateien – die Meldung darf nicht am Auffrischen hängen', () => {
  it('meldet den Erfolg des Löschens, auch wenn das Nachladen NIE zurückkommt', async () => {
    const { result, showToast } = starte({ invalidateHaengt: true });
    await waitFor(() => expect(result.current.dateien.data).toEqual(LISTE));

    act(() => result.current.setLoeschDatei(PDF));
    await act(async () => {
      await result.current.loeschenBestaetigen();
    });

    expect(deleteSongFile).toHaveBeenCalledWith(12, 2);
    expect(showToast).toHaveBeenCalledWith('„Treu - E.pdf" wurde gelöscht.');
  });

  it('meldet den Erfolg des Hochladens ebenso', async () => {
    // Beide Wege getrennt geprüft: Die Reihenfolge steht an zwei Stellen, und eine davon zu
    // korrigieren und die andere zu vergessen ist in diesem Projekt die häufigste Fehlerklasse.
    const { result, showToast } = starte({ invalidateHaengt: true });
    await waitFor(() => expect(result.current.dateien.data).toEqual(LISTE));

    await act(async () => {
      result.current.dateiGewaehlt(new File(['x'], 'neu.pdf', { type: 'application/pdf' }));
    });

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('„neu.pdf" wurde hinzugefügt.'));
  });
});

describe('useArrangementDateien – Fehler werden benannt, nicht verschluckt', () => {
  it('gibt den Grund des Servers weiter, statt „hat nicht geklappt" zu sagen', async () => {
    // Nur so weiß man, ob es am Recht, an der Datei oder am Netz lag (#270).
    deleteSongFile.mockRejectedValue(new Error('Keine Berechtigung, in ChurchTools zu löschen.'));
    const { result, showToast } = starte();
    await waitFor(() => expect(result.current.dateien.data).toEqual(LISTE));

    act(() => result.current.setLoeschDatei(PDF));
    await act(async () => {
      await result.current.loeschenBestaetigen();
    });

    expect(showToast).toHaveBeenCalledWith('Keine Berechtigung, in ChurchTools zu löschen.');
  });

  it('schließt die Rückfrage auch bei einem Fehlschlag – sie darf nicht offen stehen bleiben', async () => {
    deleteSongFile.mockRejectedValue(new Error('Fehlgeschlagen.'));
    const { result } = starte();
    await waitFor(() => expect(result.current.dateien.data).toEqual(LISTE));

    act(() => result.current.setLoeschDatei(PDF));
    await act(async () => {
      await result.current.loeschenBestaetigen();
    });

    expect(result.current.loeschDatei).toBeNull();
  });
});

describe('useArrangementDateien – Prüfung vor dem Hochladen', () => {
  it('lädt eine zu große Datei GAR NICHT hoch', async () => {
    const { result, showToast } = starte();
    await waitFor(() => expect(result.current.dateien.data).toEqual(LISTE));

    act(() => {
      result.current.dateiGewaehlt({ name: 'riesig.pdf', size: 99 * 1024 * 1024 } as File);
    });

    expect(uploadArrangementFile).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('50 MB'));
  });

  it('fragt bei gleichem Namen nach, statt still ein Doppel anzulegen', async () => {
    const { result } = starte();
    await waitFor(() => expect(result.current.dateien.data).toEqual(LISTE));

    act(() => {
      result.current.dateiGewaehlt({ name: 'Treu - E.pdf', size: 1024 } as File);
    });

    expect(uploadArrangementFile).not.toHaveBeenCalled();
    expect(result.current.uploadWarnung?.text).toMatch(/NICHT ersetzt/);
  });

  it('lädt nach dem Bestätigen der Warnung wirklich hoch', async () => {
    const { result } = starte();
    await waitFor(() => expect(result.current.dateien.data).toEqual(LISTE));

    act(() => {
      result.current.dateiGewaehlt({ name: 'Treu - E.pdf', size: 1024 } as File);
    });
    await act(async () => {
      result.current.warnungBestaetigen();
    });

    await waitFor(() => expect(uploadArrangementFile).toHaveBeenCalledTimes(1));
    expect(result.current.uploadWarnung).toBeNull();
  });
});
