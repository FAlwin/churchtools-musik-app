// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { SetlistSong } from '@shared/types/index';
import { DEFAULT_SETTINGS, type SongSettings } from '../utils/chartSettings';

/**
 * #314: „Notizen von …" (#124) war ungetestet – und es ist die einzige Stelle der App, die **fremde
 * Daten in die eigenen schreibt**. Vier Regeln zählen:
 *
 *  - **Ansehen gilt PRO LIED.** Nur für das angesehene Lied gelten die Einstellungen der anderen
 *    Person; nur so sitzen ihre Anmerkungen an den richtigen Stellen. Griffe das auf den ganzen
 *    Ablauf durch, sähe man plötzlich überall fremde Spalten und Schriftgrößen.
 *  - **„Ersetzen" räumt auch auf.** Hat die andere Person auf einer Seite NICHTS, muss die eigene
 *    Anmerkung dort weg – sonst bliebe nach dem „Ersetzen" ein Rest von einem selbst stehen.
 *  - **„Zusammenführen" vergibt neue Text-IDs.** Sonst kollidieren fremde und eigene Textobjekte.
 *  - **Tonart und Kapo bleiben persönlich**, Version/Spalten/Schrift werden übernommen.
 */
const getSharers = vi.fn();
const getSettingsOf = vi.fn();
const loadViewMirror = vi.fn();
const clearViewMirror = vi.fn();
const VIEW_NS = 'worship_teamview_';
vi.mock('../services/teamNotes', () => ({
  VIEW_NS: 'worship_teamview_',
  getSharers: (...a: unknown[]) => getSharers(...a),
  getSettingsOf: (...a: unknown[]) => getSettingsOf(...a),
  loadViewMirror: (...a: unknown[]) => loadViewMirror(...a),
  clearViewMirror: () => clearViewMirror(),
}));
vi.mock('../services/annotations', () => ({ pushField: vi.fn() }));
vi.mock('../services/userSettings', () => ({ pushSetting: vi.fn() }));
const mergeStrokes = vi.fn();
vi.mock('../utils/strokes', () => ({ mergeStrokes: (...a: unknown[]) => mergeStrokes(...a) }));

const { useTeamNotesImport } = await import('./useTeamNotesImport');

const songs = [
  { id: 12, title: 'Lied A', versions: [], documents: [] },
  { id: 34, title: 'Lied B', versions: [], documents: [] },
] as unknown as SetlistSong[];

const eigene: Record<number, SongSettings> = {
  12: { ...DEFAULT_SETTINGS, cols: 1, fontSize: 20 },
  34: { ...DEFAULT_SETTINGS, cols: 1, fontSize: 20 },
};

function starte() {
  const args = {
    songs,
    settings: eigene,
    reloadSettings: vi.fn(),
    setSyncTick: vi.fn(),
    setDrawMode: vi.fn(),
    showToast: vi.fn(),
  };
  return { ...renderHook(() => useTeamNotesImport(args)), args };
}

/** Person auswählen und eine ihrer Ebenen ansehen (der übliche Weg über den Wähler). */
async function anseheStufe(
  result: { current: ReturnType<typeof useTeamNotesImport> },
  songId = 12,
  versionKey = 'original',
  lyr = false,
  arrangementId: number | null = null,
) {
  await act(async () => {
    await result.current.openPersonLevels({ id: 5, name: 'Anna' }, songId);
  });
  act(() => result.current.viewLevel(songId, versionKey, lyr, arrangementId));
}

beforeEach(() => {
  localStorage.clear();
  getSharers.mockResolvedValue([]);
  getSettingsOf.mockResolvedValue({});
  loadViewMirror.mockResolvedValue(undefined);
  mergeStrokes.mockResolvedValue('data:vereint');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useTeamNotesImport – effSettings gelten PRO LIED', () => {
  it('reicht ohne Ansehen die eigenen Einstellungen unverändert durch', () => {
    const { result } = starte();
    expect(result.current.effSettings).toBe(eigene);
  });

  it('übernimmt beim Ansehen ihre Ansicht fürs angesehene Lied, das andere bleibt unangetastet', async () => {
    getSettingsOf.mockResolvedValue({
      worship_cols_12_original: '2',
      worship_fs_12_original: '30',
    });
    const { result } = starte();
    await anseheStufe(result);

    expect(result.current.effSettings[12].cols).toBe(2);
    expect(result.current.effSettings[12].fontSize).toBe(30);
    // Ehrlich: Dass Lied 34 unberührt bleibt, folgt schon daraus, dass `viewSettings` nur das
    // angesehene Lied enthält – die zusätzliche Prüfung auf `viewing.songId` im Hook lässt sich
    // von hier aus NICHT festhalten (siehe Kommentar dort). Der Wert bleibt trotzdem: Er hält fest,
    // dass sich das Ansehen nicht auf den ganzen Ablauf auswirkt.
    expect(result.current.effSettings[34]).toBe(eigene[34]);
  });

  it('endet beim Aufhören und gibt die eigenen Einstellungen zurück', async () => {
    getSettingsOf.mockResolvedValue({ worship_cols_12_original: '2' });
    const { result } = starte();
    await anseheStufe(result);
    act(() => result.current.stopViewing());

    expect(result.current.viewing).toBeNull();
    expect(result.current.effSettings).toBe(eigene);
    expect(clearViewMirror).toHaveBeenCalled();
  });
});

describe('useTeamNotesImport – Wähler', () => {
  it('bleibt bei den Personen stehen, wenn die Daten nicht geladen werden konnten', async () => {
    loadViewMirror.mockRejectedValue(new Error('offline'));
    const { result } = starte();
    await act(async () => {
      await result.current.openPersonLevels({ id: 5, name: 'Anna' }, 12);
    });
    expect(result.current.pickerPerson).toBeNull();
  });

  it('schaltet beim Ansehen den Zeichenmodus ab – ein Strich ginge in die falsche Ebene', async () => {
    const { result, args } = starte();
    await anseheStufe(result);
    expect(args.setDrawMode).toHaveBeenCalledWith(false);
    expect(result.current.showSharers).toBe(false);
  });

  it('räumt den Ansichts-Spiegel beim Verlassen der Chart-Ansicht', () => {
    const { unmount } = starte();
    clearViewMirror.mockClear();
    unmount();
    expect(clearViewMirror).toHaveBeenCalled();
  });
});

describe('useTeamNotesImport – Übernehmen', () => {
  /** Eine fremde Ebene im Spiegel anlegen: Striche und/oder Textobjekte je Seite. */
  function fremdeEbene(seiten: Record<number, { striche?: string; texte?: unknown[] }>) {
    for (const [seite, inhalt] of Object.entries(seiten)) {
      const base = `song12_voriginal_${seite}`;
      if (inhalt.striche) localStorage.setItem(VIEW_NS + base, inhalt.striche);
      if (inhalt.texte)
        localStorage.setItem(`${VIEW_NS + base}_text`, JSON.stringify(inhalt.texte));
    }
  }

  it('„Ersetzen" schreibt ihre Striche in die eigenen Schlüssel', async () => {
    fremdeEbene({ 0: { striche: 'data:ihre' } });
    const { result } = starte();
    await anseheStufe(result);
    await act(async () => {
      await result.current.importFrom('replace');
    });
    expect(localStorage.getItem('worship_docdraw_song12_voriginal_0')).toBe('data:ihre');
  });

  it('„Ersetzen" ENTFERNT eigene Anmerkungen auf Seiten, auf denen sie nichts hat', async () => {
    // Sie hat nur auf Seite 0 etwas – Seite 1 gehört trotzdem zur Ebene (über ihren Text).
    fremdeEbene({ 0: { striche: 'data:ihre' }, 1: { texte: [] } });
    localStorage.setItem('worship_docdraw_song12_voriginal_1', 'data:meine');
    const { result } = starte();
    await anseheStufe(result);
    await act(async () => {
      await result.current.importFrom('replace');
    });
    expect(localStorage.getItem('worship_docdraw_song12_voriginal_1')).toBeNull();
  });

  it('„Zusammenführen" legt ihre Striche über die eigenen', async () => {
    fremdeEbene({ 0: { striche: 'data:ihre' } });
    localStorage.setItem('worship_docdraw_song12_voriginal_0', 'data:meine');
    const { result } = starte();
    await anseheStufe(result);
    await act(async () => {
      await result.current.importFrom('merge');
    });
    expect(mergeStrokes).toHaveBeenCalledWith('data:meine', 'data:ihre');
    expect(localStorage.getItem('worship_docdraw_song12_voriginal_0')).toBe('data:vereint');
  });

  it('„Zusammenführen" vergibt fremden Textobjekten NEUE IDs', async () => {
    fremdeEbene({ 0: { texte: [{ id: 1, t: 'ihrer' }] } });
    localStorage.setItem(
      'worship_docdraw_song12_voriginal_0_text',
      JSON.stringify([{ id: 1, t: 'meiner' }]),
    );
    const { result } = starte();
    await anseheStufe(result);
    await act(async () => {
      await result.current.importFrom('merge');
    });

    const texte = JSON.parse(
      localStorage.getItem('worship_docdraw_song12_voriginal_0_text') ?? '[]',
    ) as { id: number; t: string }[];
    expect(texte).toHaveLength(2);
    expect(new Set(texte.map((t) => t.id)).size).toBe(2); // keine Kollision
    expect(texte.map((t) => t.t)).toEqual(['meiner', 'ihrer']);
  });

  it('übernimmt ihre Ansicht, lässt Tonart und Kapo aber persönlich', async () => {
    getSettingsOf.mockResolvedValue({
      worship_cols_12_original: '2',
      worship_fs_12_original: '30',
      worship_key_12_original: 'F#',
      worship_capo_12_original: '4',
    });
    fremdeEbene({ 0: { striche: 'data:ihre' } });
    const { result, args } = starte();
    await anseheStufe(result);
    await act(async () => {
      await result.current.importFrom('replace');
    });

    expect(localStorage.getItem('worship_cols_12_original')).toBe('2');
    expect(localStorage.getItem('worship_fs_12_original')).toBe('30');
    expect(localStorage.getItem('worship_key_12_original')).toBeNull();
    expect(localStorage.getItem('worship_capo_12_original')).toBeNull();
    expect(args.reloadSettings).toHaveBeenCalled();
    expect(args.showToast).toHaveBeenCalledWith(expect.stringContaining('Übernommen'));
  });

  it('tut nichts, wenn die angesehene Ebene gar keine Anmerkungen enthält', async () => {
    const { result, args } = starte();
    await anseheStufe(result);
    await act(async () => {
      await result.current.importFrom('replace');
    });
    expect(args.showToast).not.toHaveBeenCalled();
    expect(result.current.viewing).not.toBeNull(); // Ansicht bleibt stehen
  });
});

describe('useTeamNotesImport – Notizen MIT Arrangement (#320, 3c)', () => {
  it('übernimmt die Striche eines Kollegen, dessen Ebene ein Arrangement trägt', async () => {
    // Der gemeldete Fehler: Man konnte die Notizen auswählen, sah aber nichts – und
    // „Zusammenführen"/„Ersetzen" tat ebenfalls nichts. Ursache war eine VIERTE, von Hand
    // zusammengesetzte Schreibweise des Schlüssels, die einzige ohne Arrangement. Gelesen wurde
    // unter einem Schlüssel, den es beim Kollegen nicht gab.
    const seiner = `${VIEW_NS}song12_a45_voriginal_0`;
    localStorage.setItem(seiner, 'SEINE-STRICHE');

    const { result } = starte();
    await anseheStufe(result, 12, 'original', false, 45);
    await act(async () => {
      await result.current.importFrom('replace');
    });

    // Unter dem EIGENEN Schlüssel – und der trägt sein Arrangement, sonst wäre nichts zu sehen.
    expect(localStorage.getItem(`worship_docdraw_song12_a45_voriginal_0`)).toBe('SEINE-STRICHE');
  });

  it('lässt Bestandsnotizen ohne Arrangement weiter funktionieren', async () => {
    localStorage.setItem(`${VIEW_NS}song12_voriginal_0`, 'ALTBESTAND');
    const { result } = starte();
    await anseheStufe(result, 12, 'original', false, null);
    await act(async () => {
      await result.current.importFrom('replace');
    });
    expect(localStorage.getItem(`worship_docdraw_song12_voriginal_0`)).toBe('ALTBESTAND');
  });
});
