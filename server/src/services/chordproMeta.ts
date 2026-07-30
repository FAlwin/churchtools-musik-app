/**
 * Metadaten aus ChordPro-Text lesen (#198).
 *
 * ChordPro schreibt Kopfangaben als `{title: …}`, `{artist: …}`, `{key: E}`, `{time: 4/4}`,
 * `{tempo: 72}`. Sie haben Vorrang vor dem, was ChurchTools am Lied/Arrangement hinterlegt hat –
 * wer die Datei bearbeitet, hat das letzte Wort.
 */

/**
 * Liest einen Metadaten-Wert aus ChordPro-Text ({key: E} → "E").
 *
 * Ein leerer Wert (`{title: }`) gilt als **nicht gesetzt** und liefert `null` – sonst würde eine
 * halb getippte Kopfzeile den ChurchTools-Wert durch nichts ersetzen (#236).
 */
export function metaValue(chordpro: string, key: string): string | null {
  const re = new RegExp(`\\{${key}\\s*:\\s*([^}]*)\\}`, 'gi');
  // Ersten NICHT-leeren Treffer nehmen: eine leere Kopfzeile soll einen späteren echten Wert
  // nicht verdecken.
  for (const m of chordpro.matchAll(re)) {
    const value = m[1].trim();
    if (value) return value;
  }
  return null;
}
