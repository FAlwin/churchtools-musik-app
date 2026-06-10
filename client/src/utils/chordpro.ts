/**
 * ChordPro-Parser. Unterstützt ZWEI Dialekte:
 *  1. Standard:    {start_of_verse: Verse 1} … {end_of_verse}, Kurzform {chorus}
 *  2. SongSelect:  Abschnitte via {comment: Vers}, {comment: Chorus 2}
 *
 * Reine Funktionen, keine React-Abhängigkeit. Übernommen aus dem Design-Prototyp
 * und um den SongSelect-Dialekt + Typen erweitert.
 */
import type { ChordProSection } from '@shared/types/index';

/** Ein Akkord-/Text-Paar einer Zeile. */
export interface ChordPair {
  chord: string | null;
  text: string;
}

/**
 * Leitet aus einem Abschnitts-Label (z.B. "Vers", "Chorus 2", "Pre-Chorus")
 * den Abschnittstyp ab. Erkennt deutsche und englische Bezeichnungen.
 */
function deriveSectionType(label: string): string {
  const l = label.toLowerCase().trim();
  if (/^(pre[-\s_]?chorus|pre[-\s_]?refrain)/.test(l)) return 'pre_chorus';
  if (/^(vers|verse|strophe)/.test(l)) return 'verse';
  if (/^(chorus|refrain|kehrvers)/.test(l)) return 'chorus';
  if (/^(bridge|br[üu]cke)/.test(l)) return 'bridge';
  if (/^(intro|vorspiel)/.test(l)) return 'intro';
  if (/^(outro|nachspiel|ende)/.test(l)) return 'outro';
  if (/^(tag|coda)/.test(l)) return 'tag';
  if (/^(instrumental|solo|interlude|zwischenspiel)/.test(l)) return 'instrumental';
  return 'verse';
}

/** Zerlegt den rohen ChordPro-Text in Abschnitte. */
export function parseChordPro(text: string): ChordProSection[] {
  const lines = text.split('\n');
  const sections: ChordProSection[] = [];
  let current: ChordProSection | null = null;

  for (const raw of lines) {
    const ln = raw.trim();

    // Standard: {start_of_verse: Label}
    const startMatch = ln.match(/^\{start_of_(\w+)(?:[:\s]+(.+?))?\}$/i);
    if (startMatch) {
      current = {
        type: startMatch[1].toLowerCase(),
        label: startMatch[2] || startMatch[1],
        lines: [],
      };
      sections.push(current);
      continue;
    }

    // Standard: {end_of_verse}
    if (/^\{end_of_\w+\}$/i.test(ln)) {
      current = null;
      continue;
    }

    // Standard-Kurzform: {verse}, {chorus: 2}, {pre-chorus} …
    const shortMatch = ln.match(
      /^\{(verse|chorus|bridge|pre[-_]?chorus|intro|outro|tag)(?:[:\s]+(.+?))?\}$/i,
    );
    if (shortMatch) {
      current = {
        type: shortMatch[1].toLowerCase().replace(/-/g, '_'),
        label: shortMatch[2] || shortMatch[1],
        lines: [],
      };
      sections.push(current);
      continue;
    }

    // SongSelect-Dialekt: {comment: Vers}, {comment: Chorus 2}
    const commentMatch = ln.match(/^\{comment[:\s]+(.+?)\}$/i);
    if (commentMatch) {
      const label = commentMatch[1].trim();
      current = { type: deriveSectionType(label), label, lines: [] };
      sections.push(current);
      continue;
    }

    // Sonstige Metadaten-Direktiven ({title}, {key}, {tempo} …) überspringen
    if (/^\{.*\}$/.test(ln)) continue;

    // Leerzeile
    if (!ln) {
      if (current) current.lines.push('');
      continue;
    }

    // Inhalts-Zeile – ohne vorherigen Abschnitt einen impliziten Vers öffnen
    if (!current) {
      current = { type: 'verse', label: '', lines: [] };
      sections.push(current);
    }
    current.lines.push(ln);
  }

  // Nachlaufende Leerzeilen je Abschnitt entfernen; leere Abschnitte verwerfen
  return sections
    .map((s) => {
      const ls = [...s.lines];
      while (ls.length && !ls[ls.length - 1]) ls.pop();
      return { ...s, lines: ls };
    })
    .filter((s) => s.lines.length > 0);
}

/** Zerlegt eine einzelne Zeile in Akkord-/Text-Paare. */
export function parseLine(line: string): ChordPair[] {
  if (!line.includes('[')) return [{ chord: null, text: line }];
  const pairs: ChordPair[] = [];
  const firstIndex = line.indexOf('[');
  if (firstIndex > 0) pairs.push({ chord: null, text: line.slice(0, firstIndex) });
  const re = /\[([^\]]*)\]([^[]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    pairs.push({ chord: m[1] || null, text: m[2] });
  }
  return pairs;
}

/** Liest Metadaten ({title}, {key}, {tempo}, {ccli} …) aus dem ChordPro-Text. */
export function parseMetadata(text: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const m = raw.trim().match(/^\{(title|artist|key|tempo|time|ccli|composer|copyright)[:\s]+(.+?)\}$/i);
    if (m) meta[m[1].toLowerCase()] = m[2].trim();
  }
  return meta;
}
