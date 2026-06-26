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
      const lw = 17; // mm (eng zugeschnittenes Logo → ohne Eigenrand kleiner ansetzen)
      const logoMargin = 6; // sauber in die Ecke, oben = rechts gleich
      let lh = lw;
      if (typeof logo !== 'string' && logo.naturalWidth > 0) lh = lw * (logo.naturalHeight / logo.naturalWidth);
      d.addImage(logo, 'PNG', PAGE_W - logoMargin - lw, logoMargin, lw, lh);
      logoBottom = logoMargin + lh;
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

  type Pair = { chord: string | null; text: string };
  // Eine Liedzeile in Token zerlegen (Akkord bleibt am ersten Wort) und an Wortgrenzen so
  // umbrechen, dass sie in die Spaltenbreite passt (kein Abschneiden, kein Überlauf).
  function wrapLine(pairs: Pair[]): Pair[][] {
    d.setFont('helvetica', 'normal');
    d.setFontSize(fontPt);
    const toks: Pair[] = [];
    for (const p of pairs) {
      const words = (p.text || '').match(/\S+\s*|\s+/g);
      if (!words) {
        toks.push({ chord: p.chord, text: p.text || '' });
        continue;
      }
      // Akkord auf das erste Wort mit echtem Text legen – nicht auf ein führendes Leerzeichen
      // (Quelltext „[C] wort"). Sonst würde das Leerzeichen-Token auf Akkordbreite aufgeblasen
      // und erzeugte eine Lücke. Hat das Segment nur Leerraum (z. B. Instrumental-Akkorde ohne
      // Text), bleibt der Akkord am ersten Token (Abstand dort gewollt).
      const firstWordIdx = words.findIndex((w) => /\S/.test(w));
      const chordIdx = firstWordIdx === -1 ? 0 : firstWordIdx;
      words.forEach((w, wi) => toks.push({ chord: wi === chordIdx ? p.chord : null, text: w }));
    }
    const rows: Pair[][] = [[]];
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
    return rows;
  }

  // „Nur Text": eine Rohzeile zu sauberem, linksbündigem Fließtext aufbereiten und auf
  // Spaltenbreite umbrechen. Akkorde raus, Silbentrenner „Va - ter" → „Vater" zusammenführen,
  // Mehrfach-Leerzeichen (von Akkordpositionen) auf eines reduzieren, Einrückung trimmen.
  function lyricRows(rawLine: string): Pair[][] {
    const plain = rawLine
      .replace(/\[[^\]]*\]/g, '') // Akkorde entfernen
      .replace(/\s+-\s+/g, '') // Silbentrenner zusammenführen
      .replace(/\s{2,}/g, ' ') // Mehrfach-Leerzeichen → eines
      .trim();
    if (!plain) return [[{ chord: null, text: '' }]];
    d.setFont('helvetica', 'normal');
    d.setFontSize(fontPt);
    const lines = d.splitTextToSize(plain, colW) as string[];
    return lines.map((s) => [{ chord: null, text: s }]);
  }

  function drawRow(row: Pair[]) {
    // Führende reine Leerzeichen am Zeilenanfang weglassen (z. B. Einrückung aus „[A]   Ich")
    // → jede Zeile beginnt bündig am linken Spaltenrand. Mehrfach-Leerzeichen INNERHALB der
    // Zeile bleiben unberührt.
    let s = 0;
    while (s < row.length && !row[s].chord && !/\S/.test(row[s].text || '')) s++;
    const cells = row.slice(s);
    let cx = x;
    const yChord = y + chordPt * PT_TO_MM;
    const yLyric = y + (lyricsOnly ? 0 : chordH) + fontPt * PT_TO_MM;
    // Ein Akkord, der breiter ist als seine Silbe, darf über die folgenden akkordlosen Wörter
    // ragen (wie in Lead-Sheets üblich). Extra-Platz wird nur erzwungen, wenn direkt danach
    // wieder ein Akkord käme – sonst entstünde eine unnötige Lücke. `chordDebt` = Restbreite,
    // die der zuletzt gesetzte Akkord bis zum nächsten Akkord noch beansprucht.
    let chordDebt = 0;
    cells.forEach((p, i) => {
      d.setFont('helvetica', 'normal');
      d.setFontSize(fontPt);
      const tw = d.getTextWidth(p.text || '');
      if (p.chord) {
        d.setFont('helvetica', 'bold');
        d.setFontSize(chordPt);
        d.setTextColor(...CHORD_COLOR);
        d.text(p.chord, cx, yChord);
        chordDebt = d.getTextWidth(p.chord) + 1.5;
      }
      if (p.text) {
        d.setFont('helvetica', 'normal');
        d.setFontSize(fontPt);
        d.setTextColor(...TEXT_COLOR);
        d.text(p.text, cx, yLyric);
      }
      let adv = tw;
      chordDebt -= tw;
      const next = cells[i + 1];
      if (chordDebt > 0 && next && next.chord) {
        adv += chordDebt; // gerade so viel Platz, dass der nächste Akkord nicht überlappt
        chordDebt = 0;
      }
      if (chordDebt < 0) chordDebt = 0;
      cx += adv;
    });
    y += rowH;
  }

  sections.forEach((sec, si) => {
    const secSemi = semitones + (sectionSemitones?.[si] ?? 0);

    // Sektion vorab umbrechen + Gesamthöhe berechnen (Label + Zeilen/Leerzeilen).
    const blocks: ({ gap: true } | { rows: Pair[][] })[] = [];
    let secH = sec.label ? labelH : 0;
    for (const rawLine of sec.lines) {
      if (rawLine === '') {
        blocks.push({ gap: true });
        secH += emptyGap;
        continue;
      }
      let rows: Pair[][];
      if (lyricsOnly) {
        rows = lyricRows(rawLine);
      } else {
        const pairs = parseLine(rawLine).map((p) => ({
          chord: p.chord ? transposeChord(p.chord, secSemi, flat) : null,
          text: p.text,
        }));
        rows = wrapLine(pairs);
      }
      blocks.push({ rows });
      secH += rows.length * rowH;
    }

    // Ganze Sektion zusammenhalten: passt sie nicht mehr in die Spalte, aber komplett in eine
    // leere Spalte → vorher umbrechen (springt geschlossen auf die nächste Spalte/Seite).
    const colTop = pageNo === 0 ? startY : MARGIN;
    if (y + secH > bottom && secH <= bottom - colTop) nextColumn();

    if (sec.label) {
      ensure(labelH + rowH);
      d.setFont('helvetica', 'bold');
      d.setFontSize(labelPt);
      d.setTextColor(...LABEL_COLOR);
      d.text(sec.label.toUpperCase(), x, y + labelPt * PT_TO_MM);
      y += labelH;
    }
    for (const b of blocks) {
      if ('gap' in b) {
        y += emptyGap;
        continue;
      }
      for (const row of b.rows) {
        ensure(rowH);
        drawRow(row);
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
  /** Schlüssel der angezeigten Version ('original' oder Slug) – für versionsbezogene Anmerkungen. */
  versionKey: string;
  localPage: number;
}

/**
 * Wie generateSetlistPdf, liefert aber zusätzlich pro PDF-Seite den Besitzer (Lied + Seite darin).
 * Grundlage für den durchgehenden Seitenstrom über den ganzen Ablauf (2-up im Querformat).
 */
export function generateSetlistPdfWithOwners(
  songs: (SetlistSong & { versionKey?: string })[],
  optsFor: (song: SetlistSong) => ChordPdfOptions,
): { doc: jsPDF; owners: SetlistPageOwner[] } {
  const d = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const owners: SetlistPageOwner[] = [];
  songs.forEach((song, si) => {
    if (si > 0) d.addPage();
    const before = d.getNumberOfPages();
    generateChordPdf(song, optsFor(song), d);
    const after = d.getNumberOfPages();
    const versionKey = song.versionKey ?? 'original';
    for (let p = 0; p <= after - before; p++) {
      owners.push({ songIdx: si, songId: song.id, versionKey, localPage: p });
    }
  });
  return { doc: d, owners };
}
