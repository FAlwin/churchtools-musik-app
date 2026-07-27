/**
 * Anzeige-Bezeichnung eines Ablaufpunkts (#200).
 *
 * ChurchTools speichert bei einem Lied-Punkt ZWEI Dinge: den eigenen Titel des Punkts (bei uns
 * oft schlicht „Lied") und das verknüpfte Lied. CT zeigt beides: **Lied** - *Du großer Gott*.
 * Diese Modul-Funktionen bilden das nach – bewusst als reine Funktionen, damit die Regeln
 * testbar sind und in Liste, Vollansicht und Dialogen identisch gelten.
 */

/** Das Minimum, das für die Bezeichnung nötig ist (Liste, Vollansicht und Dialoge reichen mehr). */
export interface TitleSource {
  title: string;
  song: { title: string } | null;
}

export interface ItemTitleParts {
  /** Hauptbezeichnung: der eigene Titel – bzw. der Liedname, wenn es keinen eigenen gibt. */
  title: string;
  /** Zusätzlich anzuzeigender Liedname; null, wenn er nichts hinzufügt (kein Lied / Dopplung). */
  songName: string | null;
}

/**
 * Zerlegt einen Punkt in die Anzeige-Teile. Der Liedname entfällt bewusst, wenn er nichts
 * hinzufügt: ohne eigenen Titel (dann IST der Liedname die Bezeichnung) oder wenn der Titel
 * bereits derselbe ist (sonst stünde „Du großer Gott – Du großer Gott" in der Liste).
 */
export function itemTitleParts(item: TitleSource): ItemTitleParts {
  const own = item.title.trim();
  const song = item.song?.title.trim() ?? '';
  // Auch ohne Lied getrimmt zurückgeben (#215) – vorher war nur der Lied-Fall getrimmt, was zu
  // unterschiedlicher Darstellung desselben Titels führte.
  if (!song) return { title: own, songName: null };
  if (!own || own.toLocaleLowerCase('de') === song.toLocaleLowerCase('de')) {
    return { title: song, songName: null };
  }
  return { title: own, songName: song };
}

/** Einzeilige Klartext-Bezeichnung für Dialoge/Meldungen (z. B. „Lied – Du großer Gott"). */
export function itemLabel(item: TitleSource): string {
  const { title, songName } = itemTitleParts(item);
  return songName ? `${title} – ${songName}` : title;
}
