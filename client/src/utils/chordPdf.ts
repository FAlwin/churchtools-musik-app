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
  /** Anzuzeigende Tonart im Kopf (z. B. transponiert). Fällt auf targetKey/originalKey zurück. */
  displayKey?: string;
  /** App-Logo oben rechts (HTMLImageElement oder PNG-DataURL). Optional. */
  logo?: HTMLImageElement | string | null;
}

const PT_TO_MM = 0.352777;
// A4 Hochformat
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const COL_GAP = 8;
// Alles schwarz halten (SongSelect-Look) – damit Akkorde auch auf S/W-Druckern klar sichtbar sind.
const TEXT_COLOR: [number, number, number] = [20, 17, 15];
const CHORD_COLOR: [number, number, number] = TEXT_COLOR;
const LABEL_COLOR: [number, number, number] = TEXT_COLOR;
const MUTED_COLOR: [number, number, number] = [90, 90, 90];

/**
 * Erzeugt aus dem ChordPro eines Lieds eine SongSelect-artige PDF (Akkorde über Text,
 * Abschnitts-Labels, 1/2 Spalten, Seitenumbruch). ChordPro bleibt die Quelle – die PDF ist
 * die erzeugte Ansicht/das Export-Format. Liefert das fertige jsPDF-Dokument zurück.
 */
export function generateChordPdf(song: SetlistSong, opts: ChordPdfOptions = {}, doc?: jsPDF): jsPDF {
  const { semitones = 0, cols = 1, fontPt = 11, lyricsOnly = false, flat = false, sectionSemitones, displayKey, logo } = opts;
  const d = doc ?? new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const lyricH = fontPt * PT_TO_MM * 1.18; // Höhe einer Textzeile
  const chordPt = Math.max(8, Math.round(fontPt * 0.95));
  const chordH = chordPt * PT_TO_MM * 1.15; // Höhe einer Akkordzeile
  const rowH = (lyricsOnly ? 0 : chordH) + lyricH; // eine „musikalische" Zeile
  const emptyGap = lyricH * 0.5;
  const sectionGap = lyricH * 0.8;
  // Labels deutlicher: fett, etwas größer als der Text, mit klarem Abstand darüber.
  const labelPt = Math.max(10, Math.round(fontPt * 1.0));
  const labelH = labelPt * PT_TO_MM * 1.3 + 2.5;

  const colW = (PAGE_W - 2 * MARGIN - (cols - 1) * COL_GAP) / cols;
  const bottom = PAGE_H - MARGIN;
  let col = 0;
  let pageNo = 0; // 0 = erste Seite (mit Titelkopf); darunter beginnen die Spalten tiefer
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
      pageNo += 1;
    }
    x = colX(col);
    // Auf Seite 1 beginnen ALLE Spalten unter dem Titelkopf (sonst überlappt Spalte 2 den Titel).
    y = pageNo === 0 ? startY : MARGIN;
  }
  function ensure(space: number) {
    if (y + space > bottom) nextColumn();
  }

  // Kopf im SongSelect-Stil: Logo oben rechts, dann Titel / Autor / „Tonart - X | Taktart - Y".
  let logoBottom = MARGIN;
  if (logo) {
    try {
      const lw = 24; // mm
      let lh = lw;
      if (typeof logo !== 'string' && logo.naturalWidth > 0) lh = lw * (logo.naturalHeight / logo.naturalWidth);
      d.addImage(logo, 'PNG', PAGE_W - MARGIN - lw, MARGIN, lw, lh);
      logoBottom = MARGIN + lh;
    } catch {
      /* Logo ist optional */
    }
  }

  const titlePt = fontPt + 6;
  d.setFont('helvetica', 'bold');
  d.setFontSize(titlePt);
  d.setTextColor(...TEXT_COLOR);
  d.text(song.title, MARGIN, y + titlePt * PT_TO_MM);
  y += titlePt * PT_TO_MM + 1.5;

  const subPt = Math.max(8, fontPt - 2);
  if (song.author) {
    d.setFont('helvetica', 'normal');
    d.setFontSize(subPt);
    d.setTextColor(...MUTED_COLOR);
    d.text(song.author, MARGIN, y + subPt * PT_TO_MM);
    y += subPt * PT_TO_MM + 1;
  }

  const headKey = displayKey || song.targetKey || song.originalKey || '';
  const infoParts: string[] = [];
  if (headKey) infoParts.push(`Tonart - ${headKey}`);
  if (song.timeSig) infoParts.push(`Taktart - ${song.timeSig}`);
  if (song.bpm) infoParts.push(`${song.bpm} BPM`);
  if (infoParts.length) {
    d.setFont('helvetica', 'bold');
    d.setFontSize(subPt);
    d.setTextColor(...TEXT_COLOR);
    d.text(infoParts.join('   |   '), MARGIN, y + subPt * PT_TO_MM);
    y += subPt * PT_TO_MM + 1;
  }

  // Spalten beginnen unter dem Titelkopf UND unter dem Logo (nur Seite 1).
  const startY = Math.max(y, logoBottom) + 4;
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

      // In Wort-Token zerlegen (der Akkord bleibt am ersten Wort seines Paars) und an Wort-
      // grenzen umbrechen, damit auch lange Zeilen (z. B. ganze Sätze ohne Akkordwechsel oder
      // 2 Spalten) sauber in die Spaltenbreite passen statt rechts abgeschnitten zu werden.
      d.setFont('helvetica', 'normal');
      d.setFontSize(fontPt);
      const toks: { chord: string | null; text: string }[] = [];
      for (const p of pairs) {
        const words = (p.text || '').match(/\S+\s*|\s+/g);
        if (!words) {
          toks.push({ chord: p.chord, text: p.text || '' });
          continue;
        }
        words.forEach((w, wi) => toks.push({ chord: wi === 0 ? p.chord : null, text: w }));
      }
      const rows: { chord: string | null; text: string }[][] = [[]];
      let lineW = 0;
      for (const t of toks) {
        let adv = d.getTextWidth(t.text);
        if (t.chord) {
          d.setFont('helvetica', 'bold');
          d.setFontSize(chordPt);
          adv = Math.max(adv, d.getTextWidth(t.chord) + 1.5);
          d.setFont('helvetica', 'normal');
          d.setFontSize(fontPt);
        }
        if (lineW + adv > colW && rows[rows.length - 1].length > 0) {
          rows.push([]);
          lineW = 0;
        }
        rows[rows.length - 1].push(t);
        lineW += adv;
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

  // CCLI-Fußzeile (zentriert unten auf der letzten Seite), wenn vorhanden.
  if (song.ccli) {
    d.setFont('helvetica', 'italic');
    d.setFontSize(8);
    d.setTextColor(...MUTED_COLOR);
    d.text(`CCLI-Liednummer ${song.ccli}`, PAGE_W / 2, PAGE_H - 8, { align: 'center' });
  }

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

/** Welches Lied (und welche Seite darin) gehört zu einer Seite der zusammengefassten PDF. */
export interface SetlistPageOwner {
  songIdx: number;
  songId: number;
  localPage: number;
}

/**
 * Wie generateSetlistPdf, liefert aber zusätzlich pro PDF-Seite den Besitzer (Lied + Seite darin).
 * Grundlage für den durchgehenden Seitenstrom über den ganzen Ablauf (2-up im Querformat).
 */
export function generateSetlistPdfWithOwners(
  songs: SetlistSong[],
  optsFor: (song: SetlistSong) => ChordPdfOptions,
): { doc: jsPDF; owners: SetlistPageOwner[] } {
  const d = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const owners: SetlistPageOwner[] = [];
  songs.forEach((song, si) => {
    if (si > 0) d.addPage();
    const before = d.getNumberOfPages();
    generateChordPdf(song, optsFor(song), d);
    const after = d.getNumberOfPages();
    for (let p = 0; p <= after - before; p++) {
      owners.push({ songIdx: si, songId: song.id, localPage: p });
    }
  });
  return { doc: d, owners };
}
