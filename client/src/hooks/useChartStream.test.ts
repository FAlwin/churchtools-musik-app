// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { SetlistSong } from '@shared/types/index';
import { DEFAULT_SETTINGS, type SongSettings } from '../utils/chartSettings';

/**
 * #314: Der Aufbau des Seitenstroms lag als 40-Zeilen-Effekt in `ChordChart.tsx`. Geprüft wird das,
 * wofür er seit #197 überhaupt so aussieht:
 *
 *  - **Er läuft NICHT im Render.** Vorher stand die Oberfläche bei jeder Änderung von Tonart oder
 *    Schrift, bis das ganze Liederheft neu erzeugt war – auf einem älteren iPad spürbar.
 *  - **Das alte Ergebnis bleibt stehen, bis das neue da ist.** Sonst blitzt eine leere Ansicht auf.
 *  - **Ein überholter Aufbau wird verworfen.** Sonst überschreibt ein langsamer Lauf das neuere
 *    Ergebnis.
 */
const generateSetlistPdfWithOwners = vi.fn();
vi.mock('../utils/chordPdf', () => ({
  generateSetlistPdfWithOwners: (...a: unknown[]) => generateSetlistPdfWithOwners(...a),
}));
vi.mock('../utils/logoAsset', () => ({ logoTightUrl: 'data:image/png;base64,AA' }));

const { useChartStream } = await import('./useChartStream');

/** Ein PDF-Ergebnis, an dessen Nutzdaten man den Lauf wiedererkennt. */
function pdfErgebnis(marke: number) {
  return {
    doc: { output: () => new Uint8Array([marke]).buffer },
    owners: [{ songIdx: 0, songId: 12, localPage: 0, kind: 'chord', versionKey: 'original' }],
  };
}

const marke = (s: { data: ArrayBuffer } | null) => (s ? new Uint8Array(s.data)[0] : null);

const songs = [
  { id: 12, title: 'Lied', chordpro: '[C]x', versions: [], documents: [] },
] as unknown as SetlistSong[];
const settings: Record<number, SongSettings> = { 12: { ...DEFAULT_SETTINGS } };

beforeEach(() => {
  vi.useFakeTimers();
  generateSetlistPdfWithOwners.mockReset();
  generateSetlistPdfWithOwners.mockReturnValue(pdfErgebnis(1));
  // requestIdleCallback gibt es in jsdom nicht – der Code fällt dann auf setTimeout(0) zurück,
  // genau wie in älteren Safari-Versionen.
  expect(typeof window.requestIdleCallback).toBe('undefined');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useChartStream', () => {
  it('baut NICHT im Render, sondern erst danach', () => {
    const { result } = renderHook(() =>
      useChartStream({ songs, songsSig: 'a', settings, logo: null }),
    );
    expect(generateSetlistPdfWithOwners).not.toHaveBeenCalled();
    expect(result.current).toBeNull();

    act(() => void vi.advanceTimersByTime(0));
    expect(generateSetlistPdfWithOwners).toHaveBeenCalledTimes(1);
    expect(marke(result.current)).toBe(1);
  });

  it('liefert nichts, wenn der Ablauf leer ist', () => {
    const { result } = renderHook(() =>
      useChartStream({ songs: [], songsSig: '', settings, logo: null }),
    );
    act(() => void vi.advanceTimersByTime(0));
    expect(generateSetlistPdfWithOwners).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('lässt das ALTE Ergebnis stehen, solange das neue gebaut wird', () => {
    const { result, rerender } = renderHook(
      (p: { sig: string }) => useChartStream({ songs, songsSig: p.sig, settings, logo: null }),
      { initialProps: { sig: 'a' } },
    );
    act(() => void vi.advanceTimersByTime(0));
    expect(marke(result.current)).toBe(1);

    generateSetlistPdfWithOwners.mockReturnValue(pdfErgebnis(2));
    rerender({ sig: 'b' }); // Neuaufbau angestoßen, aber noch nicht gelaufen
    expect(marke(result.current)).toBe(1); // keine leere Ansicht dazwischen

    act(() => void vi.advanceTimersByTime(0));
    expect(marke(result.current)).toBe(2);
  });

  it('verwirft einen überholten Aufbau, statt das neuere Ergebnis zu überschreiben', () => {
    const { result, rerender } = renderHook(
      (p: { sig: string }) => useChartStream({ songs, songsSig: p.sig, settings, logo: null }),
      { initialProps: { sig: 'a' } },
    );
    // Zweite Änderung, bevor die erste überhaupt gebaut hat.
    generateSetlistPdfWithOwners.mockReturnValue(pdfErgebnis(2));
    rerender({ sig: 'b' });
    act(() => void vi.advanceTimersByTime(0));

    expect(generateSetlistPdfWithOwners).toHaveBeenCalledTimes(1); // der erste Lauf fiel aus
    expect(marke(result.current)).toBe(2);
  });

  it('baut nach dem Verlassen nicht mehr', () => {
    const { unmount } = renderHook(() =>
      useChartStream({ songs, songsSig: 'a', settings, logo: null }),
    );
    unmount();
    act(() => void vi.advanceTimersByTime(0));
    expect(generateSetlistPdfWithOwners).not.toHaveBeenCalled();
  });

  it('gibt jedem Lied den Text SEINER gewählten Version mit', () => {
    const mitVersion = [
      {
        id: 12,
        title: 'Lied',
        chordpro: '[C]original',
        versions: [{ key: 'akustik', name: 'Akustik', text: '[G]akustik' }],
        documents: [],
      },
    ] as unknown as SetlistSong[];
    renderHook(() =>
      useChartStream({
        songs: mitVersion,
        songsSig: 'a',
        settings: { 12: { ...DEFAULT_SETTINGS, versionKey: 'akustik' } },
        logo: null,
      }),
    );
    act(() => void vi.advanceTimersByTime(0));

    const uebergeben = generateSetlistPdfWithOwners.mock.calls[0][0] as {
      chordpro: string;
      versionKey: string;
    }[];
    expect(uebergeben[0].chordpro).toBe('[G]akustik');
    expect(uebergeben[0].versionKey).toBe('akustik');
  });
});
