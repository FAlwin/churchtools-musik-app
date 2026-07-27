// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SetlistSong } from '@shared/types/index';
import { useSongSettings } from './useSongSettings';

/**
 * #198: Diese Logik lag in `ChordChart` und war damit nicht prüfbar – obwohl sie darüber
 * entscheidet, was nach dem Schließen der App noch da ist.
 *
 * Die Regel, die man leicht übersieht und die hier festgehalten wird: Fast alles gilt **pro
 * Version** (wer eine Akustik-Fassung anders eingestellt hat, soll das behalten), aber die gewählte
 * Version selbst und die Anzeigequelle gelten **pro Lied**. Wird das verwechselt, verliert man
 * beim Versionswechsel entweder seine Einstellungen oder man kann die Version nicht mehr wechseln.
 */
vi.mock('../services/userSettings', () => ({
  pushSetting: vi.fn(),
  migrateLocalSettings: vi.fn(),
  pullSettings: vi.fn(),
}));

function song(over: Partial<SetlistSong> = {}): SetlistSong {
  return {
    id: 1,
    title: 'Lied',
    chordpro: '{title: Lied}',
    originalKey: 'C',
    targetKey: 'C',
    versions: [{ key: 'akustik', name: 'Akustik', text: '{title: Akustik}' }],
    documents: [],
    ...over,
  } as unknown as SetlistSong;
}

beforeEach(() => localStorage.clear());

describe('useSongSettings – Einstellungen ändern und behalten', () => {
  it('startet mit den Standardwerten, wenn nichts gespeichert ist', () => {
    const { result } = renderHook(() => useSongSettings([song()]));
    expect(result.current.settings[1]).toMatchObject({
      key: null,
      capo: 0,
      cols: 1,
      fontSize: 20,
      lyricsOnly: false,
      versionKey: 'original',
      viewSource: 'chords',
    });
  });

  it('übernimmt eine Änderung sofort in den Zustand', () => {
    const { result } = renderHook(() => useSongSettings([song()]));
    act(() => result.current.updateSetting(1, { capo: 2, fontSize: 24 }));
    expect(result.current.settings[1]).toMatchObject({ capo: 2, fontSize: 24 });
  });

  it('schreibt sie unter dem VERSIONS-Schlüssel in den Speicher', () => {
    const { result } = renderHook(() => useSongSettings([song()]));
    act(() => result.current.updateSetting(1, { capo: 3 }));
    expect(localStorage.getItem('worship_capo_1_original')).toBe('3');
  });

  it('schreibt nur, was tatsächlich im Patch steht', () => {
    const { result } = renderHook(() => useSongSettings([song()]));
    act(() => result.current.updateSetting(1, { capo: 3 }));
    expect(localStorage.getItem('worship_fs_1_original')).toBeNull();
    expect(localStorage.getItem('worship_key_1_original')).toBeNull();
  });

  it('leere Abschnitts-Transponierung wird entfernt statt als „{}" gespeichert', () => {
    const { result } = renderHook(() => useSongSettings([song()]));
    act(() => result.current.updateSetting(1, { secShift: { 2: 1 } }));
    expect(localStorage.getItem('worship_secshift_1_original')).toBe('{"2":1}');
    act(() => result.current.updateSetting(1, { secShift: {} }));
    expect(localStorage.getItem('worship_secshift_1_original')).toBeNull();
  });

  it('liest Gespeichertes beim Start wieder ein', () => {
    localStorage.setItem('worship_capo_1_original', '4');
    localStorage.setItem('worship_lyrics_1_original', '1');
    const { result } = renderHook(() => useSongSettings([song()]));
    expect(result.current.settings[1]).toMatchObject({ capo: 4, lyricsOnly: true });
  });
});

describe('useSongSettings – pro Version oder pro Lied?', () => {
  it('jede Version hat ihre EIGENEN Einstellungen', () => {
    const s = song();
    const { result } = renderHook(() => useSongSettings([s]));
    act(() => result.current.updateSetting(1, { capo: 2 }));

    act(() => result.current.selectVersion(1, 'akustik'));
    expect(result.current.settings[1].capo).toBe(0); // eigene, noch unberührte Ebene
    act(() => result.current.updateSetting(1, { capo: 5 }));

    act(() => result.current.selectVersion(1, 'original'));
    expect(result.current.settings[1].capo).toBe(2); // die alte ist unversehrt
  });

  it('die gewählte Version gilt fürs LIED (ohne Versions-Suffix im Schlüssel)', () => {
    const { result } = renderHook(() => useSongSettings([song()]));
    act(() => result.current.selectVersion(1, 'akustik'));
    expect(localStorage.getItem('worship_ver_1')).toBe('akustik');
    expect(result.current.settings[1].versionKey).toBe('akustik');
  });

  it('die Anzeigequelle gilt fürs LIED – sie hängt am Arrangement, nicht an der Fassung', () => {
    const s = song({ documents: [{ fileId: 77, name: 'Noten.pdf', type: 'pdf' }] });
    const { result } = renderHook(() => useSongSettings([s]));
    act(() => result.current.updateSetting(1, { viewSource: 77 }));
    expect(localStorage.getItem('worship_view_1')).toBe('77');

    // Auch nach einem Versionswechsel bleibt das Dokument die Anzeigequelle.
    act(() => result.current.selectVersion(1, 'akustik'));
    expect(result.current.settings[1].viewSource).toBe(77);
  });

  it('eine Anzeigequelle, die es nicht mehr gibt, fällt auf die Akkorde zurück', () => {
    localStorage.setItem('worship_view_1', '999'); // Dokument in ChurchTools gelöscht
    const { result } = renderHook(() => useSongSettings([song()]));
    expect(result.current.settings[1].viewSource).toBe('chords');
  });
});

describe('useSongSettings – neu einlesen', () => {
  it('reloadSettings übernimmt einen von außen geänderten Speicher (Konto-Sync)', () => {
    const { result } = renderHook(() => useSongSettings([song()]));
    expect(result.current.settings[1].capo).toBe(0);

    // So sieht es aus, wenn pullSettings den Server-Stand in den localStorage gespiegelt hat.
    localStorage.setItem('worship_capo_1_original', '7');
    act(() => result.current.reloadSettings());
    expect(result.current.settings[1].capo).toBe(7);
  });

  it('eine geänderte Lied-Liste bringt Einstellungen für die neuen Lieder mit', () => {
    localStorage.setItem('worship_capo_2_original', '1');
    const { result, rerender } = renderHook(({ list }) => useSongSettings(list), {
      initialProps: { list: [song()] },
    });
    expect(result.current.settings[2]).toBeUndefined();

    rerender({ list: [song(), song({ id: 2 })] });
    expect(result.current.settings[2]?.capo).toBe(1);
  });
});
