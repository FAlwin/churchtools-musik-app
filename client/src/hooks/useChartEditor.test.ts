// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { SetlistSong } from '@shared/types/index';

/**
 * #314: Der Editor-Hook war ungetestet, obwohl er als einziger Teil der Chart-Ansicht in
 * ChurchTools **schreibt**. Drei Dinge zählen:
 *
 *  - **Am Original wird nie geschrieben.** „Bearbeiten" legt dort eine NEUE Version an. Das Original
 *    kommt aus dem Arrangement und gehört allen; es zu überschreiben träfe jeden im Team.
 *  - **Ein Fehlschlag lässt den Editor OFFEN.** Sonst ist der eben getippte Text weg – und mit ihm
 *    die Arbeit eines Abends. Das gilt für vorübergehende Fehler genauso wie für abgelehnte (#270).
 *  - **Der Speicher-Status geht in jedem Fall wieder aus**, auch nach einem Fehler; sonst bliebe der
 *    Knopf für immer auf „Speichern…".
 */
const createVersion = vi.fn();
const updateVersion = vi.fn();
const deleteVersion = vi.fn();
vi.mock('../services/churchtoolsApi', () => ({
  createVersion: (...a: unknown[]) => createVersion(...a),
  updateVersion: (...a: unknown[]) => updateVersion(...a),
  deleteVersion: (...a: unknown[]) => deleteVersion(...a),
}));

const { ApiError } = await import('../services/api');
const { useChartEditor } = await import('./useChartEditor');

const song = { id: 12, arrangementId: 77, title: 'Lied', targetKey: 'C' } as unknown as SetlistSong;

function starte(over: Partial<Parameters<typeof useChartEditor>[0]> = {}) {
  const args = {
    song,
    versionKey: 'original',
    isOriginal: true,
    currentVersionName: 'Original',
    displayedChordpro: '[C]Bestand',
    editorTemplate: '{title: Lied}',
    // Notiert in C, Blatt in C: Der Start-Text bleibt buchstäblich der Bestand (#398).
    notierteTonart: 'C',
    curKey: 'C',
    onReload: vi.fn(),
    selectVersion: vi.fn(),
    ...over,
  };
  return { ...renderHook(() => useChartEditor(args)), args };
}

beforeEach(() => {
  createVersion.mockResolvedValue({ key: 'neu' });
  updateVersion.mockResolvedValue({ key: 'akustik' });
  deleteVersion.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useChartEditor – Öffnen', () => {
  it('legt beim Bearbeiten des ORIGINALS eine neue Version an, statt es zu überschreiben', () => {
    const { result } = starte({ isOriginal: true });
    act(() => result.current.openEditCurrent());
    expect(result.current.editor.mode).toBe('new');
    expect(result.current.editor.name).toBe('');
    // Der bestehende Text ist trotzdem der Start – man will ihn ja abwandeln. Seit #398 nennt er
    // seine Tonart selbst: Ohne die Zeile nähme die App später die des Originals an.
    expect(result.current.editor.text).toBe('{key: C}\n[C]Bestand');
  });

  it('bearbeitet eine benannte Version wirklich', () => {
    const { result } = starte({ isOriginal: false, currentVersionName: 'Akustik' });
    act(() => result.current.openEditCurrent());
    expect(result.current.editor.mode).toBe('edit');
    expect(result.current.editor.name).toBe('Akustik');
  });

  it('nimmt die Vorlage, wenn es noch gar keinen Text gibt', () => {
    const { result } = starte({ displayedChordpro: '' });
    act(() => result.current.openNewVersion());
    // Auch die Vorlage bekommt ihre Tonart-Zeile (#398) – hinter dem Kopfblock.
    expect(result.current.editor.text).toBe('{title: Lied}\n{key: C}');
  });
});

/**
 * #398: Der Editor öffnet in der Tonart, die auf dem BLATT steht – nicht in der, in der der Text
 * notiert ist. Alwin hat einen Abend lang zurückgerechnet, weil das vorher anders war.
 */
describe('useChartEditor – öffnet in der Tonart des Blatts (#398)', () => {
  it('verschiebt den Text von der notierten zur klingenden Tonart und setzt die {key}-Zeile', () => {
    const { result } = starte({
      displayedChordpro: '{key: G}\n[G]Herr [D]du',
      notierteTonart: 'G',
      curKey: 'D',
    });
    act(() => result.current.openEditCurrent());
    expect(result.current.editor.text).toBe('{key: D}\n[D]Herr [A]du');
  });

  it('auch beim Bearbeiten einer benannten Version', () => {
    const { result } = starte({
      isOriginal: false,
      currentVersionName: 'Akustik',
      displayedChordpro: '[D]Text',
      notierteTonart: 'D',
      curKey: 'E',
    });
    act(() => result.current.openEditCurrent());
    expect(result.current.editor.text).toBe('{key: E}\n[E]Text');
  });

  it('lässt die Akkorde buchstäblich in Ruhe, wenn Blatt und Text dieselbe Tonart haben', () => {
    // Kein Umschreiben von Bb zu A# bei jemandem, der nur eine Zeile ändern will.
    const { result } = starte({
      displayedChordpro: '{key: Bb}\n[Bb]Text [Eb/G]mehr',
      notierteTonart: 'Bb',
      curKey: 'Bb',
    });
    act(() => result.current.openEditCurrent());
    expect(result.current.editor.text).toBe('{key: Bb}\n[Bb]Text [Eb/G]mehr');
  });
});

/**
 * Die auf dem Blatt gewählte Tonart geht in die NEUE Version mit (#398). Sonst zeigte die frische
 * Version die Zieltonart aus ChurchTools – der Nutzer hätte gerade in D geschrieben und sähe G.
 */
describe('useChartEditor – die gewählte Tonart geht in die neue Version mit (#398)', () => {
  it('übernimmt die Tonart, wenn sie von der Zieltonart abweicht', async () => {
    const uebernimmTonart = vi.fn();
    const { result } = starte({ curKey: 'D', notierteTonart: 'C', uebernimmTonart });
    act(() => result.current.openNewVersion());
    await act(async () => {
      await result.current.handleEditorSave('{key: D}\n[D]Neu', 'Akustik');
    });
    expect(uebernimmTonart).toHaveBeenCalledWith(12, 'D');
  });

  it('übernimmt nichts, wenn Blatt und Zieltonart gleich sind – der Standard reicht', async () => {
    const uebernimmTonart = vi.fn();
    const { result } = starte({ curKey: 'C', uebernimmTonart });
    act(() => result.current.openNewVersion());
    await act(async () => {
      await result.current.handleEditorSave('[C]Neu', 'Akustik');
    });
    expect(uebernimmTonart).not.toHaveBeenCalled();
  });

  it('übernimmt beim BEARBEITEN nichts – die Version hat ihre Einstellungen schon', async () => {
    const uebernimmTonart = vi.fn();
    const { result } = starte({
      isOriginal: false,
      versionKey: 'akustik',
      curKey: 'D',
      notierteTonart: 'D',
      uebernimmTonart,
    });
    act(() => result.current.openEditCurrent());
    await act(async () => {
      await result.current.handleEditorSave('[D]Neu', 'Akustik');
    });
    expect(uebernimmTonart).not.toHaveBeenCalled();
  });
});

describe('useChartEditor – Speichern', () => {
  it('legt im Modus „neu" eine Version an und wählt sie danach aus', async () => {
    const { result, args } = starte();
    act(() => result.current.openNewVersion());
    await act(async () => {
      await result.current.handleEditorSave('[G]Neu', 'Akustik');
    });
    expect(createVersion).toHaveBeenCalledWith(12, 77, 'Akustik', '[G]Neu');
    expect(updateVersion).not.toHaveBeenCalled();
    expect(args.selectVersion).toHaveBeenCalledWith(12, 'neu');
    expect(args.onReload).toHaveBeenCalled();
    expect(result.current.showEditor).toBe(false);
  });

  it('ändert im Modus „bearbeiten" die vorhandene Version', async () => {
    const { result } = starte({ isOriginal: false, versionKey: 'akustik' });
    act(() => result.current.openEditCurrent());
    await act(async () => {
      await result.current.handleEditorSave('[G]Neu', 'Akustik');
    });
    expect(updateVersion).toHaveBeenCalledWith(12, 77, 'akustik', {
      text: '[G]Neu',
      name: 'Akustik',
    });
    expect(createVersion).not.toHaveBeenCalled();
  });

  it('legt auch aus dem Modus „bearbeiten" heraus NEU an, solange das Original gewählt ist', async () => {
    const { result } = starte({ isOriginal: true });
    act(() => result.current.openEditCurrent());
    await act(async () => {
      await result.current.handleEditorSave('[G]Neu', 'Akustik');
    });
    expect(createVersion).toHaveBeenCalled();
    expect(updateVersion).not.toHaveBeenCalled();
  });

  it('lässt den Editor bei einem Fehlschlag OFFEN – sonst ist der getippte Text weg', async () => {
    createVersion.mockRejectedValue(new ApiError(502, 'ChurchTools antwortet nicht.'));
    const { result, args } = starte();
    act(() => result.current.openNewVersion());
    await act(async () => {
      await result.current.handleEditorSave('[G]Neu', 'Akustik');
    });
    expect(result.current.showEditor).toBe(true);
    expect(result.current.editorError).toBe('ChurchTools antwortet nicht.');
    expect(result.current.editorSaving).toBe(false);
    expect(args.onReload).not.toHaveBeenCalled();
  });

  it('meldet einen unbekannten Fehler verständlich statt roh', async () => {
    createVersion.mockRejectedValue(new Error('TypeError: undefined'));
    const { result } = starte();
    await act(async () => {
      await result.current.handleEditorSave('x', 'y');
    });
    expect(result.current.editorError).toBe('Speichern fehlgeschlagen.');
  });
});

describe('useChartEditor – Löschen', () => {
  it('löscht die Version und kehrt zum Original zurück', async () => {
    const { result, args } = starte({ isOriginal: false, versionKey: 'akustik' });
    act(() => result.current.setConfirmDelEdited(true));
    await act(async () => {
      await result.current.handleDeleteVersion();
    });
    expect(deleteVersion).toHaveBeenCalledWith(12, 77, 'akustik');
    expect(args.selectVersion).toHaveBeenCalledWith(12, 'original');
    expect(result.current.confirmDelEdited).toBe(false);
    expect(args.onReload).toHaveBeenCalled();
  });

  it('lässt die Rückfrage bei einem Fehlschlag stehen und meldet ihn', async () => {
    deleteVersion.mockRejectedValue(new ApiError(403, 'Keine Berechtigung.'));
    const { result, args } = starte({ isOriginal: false, versionKey: 'akustik' });
    act(() => result.current.setConfirmDelEdited(true));
    await act(async () => {
      await result.current.handleDeleteVersion();
    });
    expect(result.current.confirmDelEdited).toBe(true);
    expect(result.current.editorError).toBe('Keine Berechtigung.');
    expect(result.current.editorSaving).toBe(false);
    expect(args.selectVersion).not.toHaveBeenCalled();
  });
});
