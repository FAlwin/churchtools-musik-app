/**
 * **Aus ChordPro die Liedtext-Abschnitte für die Vorschau** (#379, 04.09.2026).
 *
 * Alwin: „In der Vorschau wäre es cool, wenn der ganze Text scrollbar sichtbar ist. Manchmal braucht
 * man genau den Chorus und die eine Passage, um auf das Lied zu kommen." Vorher zeigte die Vorschau
 * eigener Lieder nur einen gekürzten Anfang in einer Zeile.
 *
 * **Nutzt `parseChordPro` und `parseLine` – die Zerlegung, die auch das Blatt macht.** Damit heißen
 * die Abschnitte hier genauso wie dort (Vers 1, Chorus, Bridge – beide Dialekte, Standard und
 * SongSelect), und eine spätere Korrektur am Parser landet automatisch in der Vorschau. Ein eigener
 * Abschnitts-Parser wäre die Fehlerklasse, die dieses Projekt am häufigsten getroffen hat.
 *
 * Akkorde fliegen heraus, Zeilenumbrüche bleiben (`white-space: pre-line` in der Vorschau). Leere
 * Abschnitte fallen weg – der Parser liefert sie nicht.
 */
import type { LiedtextTeil } from '@shared/types/index';
import { parseChordPro, parseLine } from './chordpro';

/** Eine ChordPro-Zeile ohne Akkorde – nur der Text, so wie er gesungen wird. */
function nurText(zeile: string): string {
  return parseLine(zeile)
    .map((p) => p.text)
    .join('')
    .replace(/\s+$/, '');
}

export function chordproZuTeile(chordpro: string): LiedtextTeil[] {
  return parseChordPro(chordpro)
    .map((s) => ({
      label: s.label,
      text: s.lines.map(nurText).join('\n').trim(),
    }))
    .filter((t) => t.text.length > 0);
}
