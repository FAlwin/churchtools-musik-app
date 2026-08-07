import type { ChordProSection, SetlistSong, SongDocument } from '@shared/types/index';
import type { SongSettings } from './chartSettings';
import { parseChordPro } from './chordpro';
import { availableVersions, type ResolvedVersion } from './songVersions';
import { shiftKey } from './transpose';

/**
 * Was aus dem aktiven Lied plus seinen Einstellungen folgt (#314).
 *
 * Diese Ableitungen standen als 30 Zeilen loser Konstanten mitten in `ChordChart.tsx` und waren
 * damit nicht prüfbar, obwohl sie die halbe Kopfzeile und den ganzen Editor speisen. Als eine reine
 * Funktion sind sie es – und die Komponente hat einen Wert statt zwölf.
 *
 * Bewusst OHNE JSX: `headInfo` liefert Daten, keine React-Knoten. Vorher baute die Kopfzeile hier
 * direkt `<span className={styles.infoKey}>` – dadurch hing die Logik am Stylesheet und ließ sich
 * nur mit gerendertem Baum prüfen. Die Zuordnung Art → Klasse macht jetzt die Kopfzeile.
 */

/** Ein Teil der Info-Zeile im Kopf-Knopf. `art` entscheidet nur über die Darstellung. */
export type HeadInfoPart =
  | { art: 'key'; text: string }
  | { art: 'capo'; text: string }
  | { art: 'plain'; text: string };

export interface ActiveSongView {
  /** Klingende Tonart: eigene Wahl, sonst die Ziel-Tonart des Lieds. */
  curKey: string;
  /** Gegriffene Tonart – der Kapo hebt an, notiert wird also entsprechend tiefer. */
  shapeKey: string;
  /** Original + benannte Versionen. */
  versions: ResolvedVersion[];
  currentVersion: ResolvedVersion;
  isOriginal: boolean;
  /** Hat das Lied überhaupt benannte Versionen? (sonst ist die Versions-Anzeige sinnlos) */
  hasVersions: boolean;
  /** ChordPro-Text der gewählten Version – das, was auf dem Blatt steht. */
  displayedChordpro: string;
  sections: ChordProSection[];
  /** Startgerüst für ein Lied ohne Text. */
  editorTemplate: string;
  /** Gewähltes Dokument statt der Akkorde – oder null, wenn Akkorde gezeigt werden. */
  activeDoc: SongDocument | null;
  /** Info-Zeile im Kopf-Knopf: Tonart/Capo/Version/Tempo bzw. Dokument-Hinweis. */
  headInfo: HeadInfoPart[];
}

export function deriveActiveSongView(song: SetlistSong, set: SongSettings): ActiveSongView {
  const curKey = set.key || song.targetKey;
  const shapeKey = shiftKey(curKey, -set.capo);

  const versions = availableVersions(song);
  // `availableVersions` liefert immer mindestens das Original – der Rückfall greift, wenn eine
  // gespeicherte Version inzwischen in ChurchTools gelöscht wurde.
  const currentVersion = versions.find((v) => v.key === set.versionKey) ?? versions[0];
  const isOriginal = currentVersion.key === 'original';
  const hasVersions = song.versions.length > 0;
  const displayedChordpro = currentVersion.text;

  const activeDoc =
    set.viewSource === 'chords'
      ? null
      : (song.documents.find((d) => d.fileId === set.viewSource) ?? null);

  const headInfo: HeadInfoPart[] = [];
  if (activeDoc) {
    headInfo.push({ art: 'plain', text: activeDoc.type === 'pdf' ? 'PDF' : 'Bild' });
  } else {
    // „Nur Text" und die Tonart schließen einander aus: Ohne Akkorde sagt eine Tonart nichts aus.
    if (set.lyricsOnly) headInfo.push({ art: 'plain', text: 'Nur Text' });
    else headInfo.push({ art: 'key', text: curKey });
    if (!set.lyricsOnly && set.capo > 0) headInfo.push({ art: 'capo', text: `Capo ${set.capo}` });
    if (hasVersions) headInfo.push({ art: 'plain', text: currentVersion.name });
    if (song.bpm !== null) headInfo.push({ art: 'plain', text: `♩ ${song.bpm}` });
  }

  return {
    curKey,
    shapeKey,
    versions,
    currentVersion,
    isOriginal,
    hasVersions,
    displayedChordpro,
    sections: parseChordPro(displayedChordpro),
    editorTemplate: buildEditorTemplate(song),
    activeDoc,
    headInfo,
  };
}

/** Startgerüst für ein Lied, zu dem es noch keinen ChordPro-Text gibt. */
function buildEditorTemplate(song: SetlistSong): string {
  const key = song.targetKey || song.originalKey || 'C';
  return `{title: ${song.title}}\n{key: ${key}}\n\n{comment: Vers 1}\n[${song.targetKey || 'C'}]Hier Text mit Akkorden eingeben\n\n{comment: Chorus}\n`;
}
