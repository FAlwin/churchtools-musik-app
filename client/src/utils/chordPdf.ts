import { jsPDF } from 'jspdf';
import { parseChordPro, parseLine } from './chordpro';
import { transposeChord } from './transpose';
import type { SetlistSong } from '@shared/types/index';

/** Optionen für die PDF-Erzeugung aus ChordPro (Issue: PDF-Export). */
export interface ChordPdfOptions {
  /** Halbton-Versatz (Transponieren + Kapo). */
  semitones?: number;
  /** Spalten pro Seite (1 oder 2). */
  cols?: 1 | 2;
  /** Schriftgröße der Liedzeilen in pt. */
  fontPt?: number;
  /** Nur Text (Akkorde ausblenden). */
  lyricsOnly?: boolean;
  /** Mit Flats statt Sharps spelling. */
  flat?: boolean;
  /** Zusätzlicher Halbton-Versatz je Abschnitts-Index (Issue #16). */
  sectionSemitones?: Record<number, number>;
}

const PT_TO_MM = 0.352777;
// A4 Hochformat
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const COL_GAP = 8;
const CHORD_COLOR: [number, number, number] = [0, 97, 161]; // ChurchTools-Blau
const LABEL_COLOR: [number, number, number] = [0, 97, 161];
const TEXT_COLOR: [number, number, number] = [20, 17, 15];

/**
 * Erzeugt aus dem ChordPro eines Lieds eine SongSelect-artige PDF (Akkorde über Text,
 * Abschnitts-Labels, 1/2 Spalten, Seitenumbruch). ChordPro bleibt die Quelle – die PDF ist
 * die erzeugte Ansicht/das Export-Format. Liefert das fertige jsPDF-Dokument zurück.
 */
export function generateChordPdf(song: SetlistSong, opts: ChordPdfOptions = {}, doc?: jsPDF): jsPDF {
  const { semitones = 0, cols = 1, fontPt = 11, lyricsOnly = false, flat = false, sectionSemitones } = opts;
  const d = doc ?? new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const lyricH = fontPt * PT_TO_MM * 1.18; // Höhe einer Textzeile
  const chordPt = Math.max(8, Math.round(fontPt * 0.95));
  const chordH = chordPt * PT_TO_MM * 1.15; // Höhe einer Akkordzeile
  const rowH = (lyricsOnly ? 0 : chordH) + lyricH; // eine „musikalische" Zeile
  const emptyGap = lyricH * 0.5;
  const sectionGap = lyricH * 0.8;
  const labelPt = Math.max(9, Math.round(fontPt * 0.85));
  const labelH = labelPt * PT_TO_MM * 1.3 + 1.5;

  const colW = (PAGE_W - 2 * MARGIN - (cols - 1) * COL_GAP) / cols;
  const bottom = PAGE_H - MARGIN;
  let col = 0;
  let x = MARGIN;
  let y = MARGIN;

  function colX(c: number): number {
    return MARGIN + c * (colW + COL_GAP);
  }
  function nextColumn() {
    col += 1;
    if (col >= cols) {
      d.addPage();
      col = 0;
    }
    x = colX(col);
    y = MARGIN;
  }
  function ensure(space: number) {
    if (y + space > bottom) nextColumn();
  }

  // Titelkopf (klein, oben auf Seite 1)
  d.setFont('helvetica', 'bold');
  d.setFontSize(fontPt + 3);
  d.setTextColor(...TEXT_COLOR);
  d.text(song.title, MARGIN, y + (fontPt + 3) * PT_TO_MM);
  y += (fontPt + 3) * PT_TO_MM + 3;
  const headerBottom = y;
  // Spalten beginnen unter dem Titel (nur Seite 1, Spalte 0)
  const startY = headerBottom;
  y = startY;
  x = colX(0);

  const sections = parseChordPro(song.chordpro);

  sections.forEach((sec, si) => {
    const secSemi = semitones + (sectionSemitones?.[si] ?? 0);
    // Label
    if (sec.label) {
      ensure(labelH + rowH);
      d.setFont('helvetica', 'bold');
      d.setFontSize(labelPt);
      d.setTextColor(...LABEL_COLOR);
      d.text(sec.label.toUpperCase(), x, y + labelPt * PT_TO_MM);
      y += labelH;
    }

    for (const rawLine of sec.lines) {
      if (rawLine === '') {
        y += emptyGap;
        continue;
      }
      const pairs = parseLine(rawLine).map((p) => ({
        chord: p.chord && !lyricsOnly ? transposeChord(p.chord, secSemi, flat) : null,
        text: p.text,
      }));

      // In Zeilen umbrechen, die in die Spaltenbreite passen (an Paar-Grenzen).
      d.setFont('helvetica', 'normal');
      d.setFontSize(fontPt);
      const rows: { chord: string | null; text: string }[][] = [[]];
      let lineW = 0;
      for (const p of pairs) {
        const w = d.getTextWidth(p.text || '');
        if (lineW + w > colW && rows[rows.length - 1].length > 0) {
          rows.push([]);
          lineW = 0;
        }
        rows[rows.length - 1].push(p);
        lineW += w;
      }

      for (const row of rows) {
        ensure(rowH);
        let cx = x;
        const yChord = y + chordPt * PT_TO_MM;
        const yLyric = y + (lyricsOnly ? 0 : chordH) + fontPt * PT_TO_MM;
        for (const p of row) {
          d.setFont('helvetica', 'normal');
          d.setFontSize(fontPt);
          const tw = d.getTextWidth(p.text || '');
          if (p.chord) {
            d.setFont('helvetica', 'bold');
            d.setFontSize(chordPt);
            d.setTextColor(...CHORD_COLOR);
            d.text(p.chord, cx, yChord);
          }
          if (p.text) {
            d.setFont('helvetica', 'normal');
            d.setFontSize(fontPt);
            d.setTextColor(...TEXT_COLOR);
            d.text(p.text, cx, yLyric);
          }
          // Vorschub: Textbreite, mind. aber Akkordbreite (+kleiner Abstand), wenn Text kürzer.
          let adv = tw;
          if (p.chord) {
            d.setFont('helvetica', 'bold');
            d.setFontSize(chordPt);
            adv = Math.max(adv, d.getTextWidth(p.chord) + 1.5);
          }
          cx += adv;
        }
        y += rowH;
      }
    }
    y += sectionGap;
  });

  return d;
}

/** Mehrere Lieder zu EINER PDF zusammenfassen (z. B. ganze Veranstaltung). */
export function generateSetlistPdf(
  songs: SetlistSong[],
  optsFor: (song: SetlistSong) => ChordPdfOptions,
): jsPDF {
  const d = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  songs.forEach((song, i) => {
    if (i > 0) d.addPage();
    generateChordPdf(song, optsFor(song), d);
  });
  return d;
}
