import type { SetlistSong } from '@shared/types/index';
import type { ChordPdfOptions } from './chordPdf';
import type { SongSettings } from './chartSettings';
import { getSemitoneOffset } from './transpose';

/**
 * Übersetzt die Anzeige-Einstellungen eines Lieds in die PDF-Optionen (#197).
 *
 * Lag bisher inline in `ChordChart.tsx` mitten im Render-Pfad. Als reine Funktion ist vor allem die
 * **Tonart-Rechnung** prüfbar: Der Versatz ist `Ziel − Original`, und der **Kapo wird abgezogen** –
 * ein Kapo im 2. Bund heißt, dass 2 Halbtöne TIEFER notiert wird, weil der Kapo sie wieder anhebt.
 * Ein Vorzeichenfehler hier transponiert das ganze Liederheft falsch.
 */
export function pdfOptionsForSong(
  song: SetlistSong,
  st: SongSettings,
  logo: HTMLImageElement | string | null = null,
): ChordPdfOptions {
  const targetKey = st.key || song.targetKey;
  return {
    semitones: getSemitoneOffset(song.originalKey, targetKey) - st.capo,
    cols: st.cols,
    // Die Anzeige rechnet in Bildschirm-Pixeln, die PDF in Punkt – 0,6 ist der eingespielte Faktor.
    // Nie unter 8 pt, sonst wird das Chart auf dem Notenständer unlesbar.
    fontPt: Math.max(8, Math.round(st.fontSize * 0.6)),
    lyricsOnly: st.lyricsOnly,
    sectionSemitones: st.secShift,
    displayKey: targetKey,
    logo,
  };
}
