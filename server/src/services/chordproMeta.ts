/**
 * Metadaten aus ChordPro-Text lesen (#198).
 *
 * ChordPro schreibt Kopfangaben als `{key: E}`, `{time: 4/4}`, `{tempo: 72}`. Sie haben Vorrang vor
 * dem, was ChurchTools am Arrangement hinterlegt hat – wer die Datei bearbeitet, hat das letzte Wort.
 */

/** Liest einen Metadaten-Wert aus ChordPro-Text ({key: E} → "E"). */
export function metaValue(chordpro: string, key: string): string | null {
  const m = chordpro.match(new RegExp(`\\{${key}\\s*:\\s*([^}]+)\\}`, 'i'));
  return m ? m[1].trim() : null;
}
