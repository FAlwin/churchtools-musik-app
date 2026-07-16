/**
 * Lokal erkannte „aufgelöst"-Platzhalter (#178).
 *
 * Der Server markiert Löschungen nur gegen die „gesehen"-Basislinie (Stand beim letzten VERLASSEN
 * des Termins). Ein Punkt, der seit dem Betreten HINZUKAM und wieder gelöscht wird, steht dort nie
 * drin – für ihn kommt also KEIN removed-Platzhalter vom Server, er verschwände kommentarlos.
 * Die Ansicht weiß aber selbst, was sie zuletzt angezeigt hat: dieser Helfer vergleicht den zuletzt
 * angezeigten Stand mit den aktuell vorhandenen IDs und liefert für verschwundene Punkte die
 * Platzhalter-Daten (inkl. Einfüge-Position wie beim Server: hinter dem letzten noch vorhandenen
 * Vorgänger, `null` = ganz vorne).
 */
export interface ShownRow {
  id: number;
  title: string;
}

export function vanishedRows(
  prevRows: ShownRow[],
  presentIds: ReadonlySet<number>,
): { id: number; title: string; afterId: number | null }[] {
  const out: { id: number; title: string; afterId: number | null }[] = [];
  prevRows.forEach((row, i) => {
    if (presentIds.has(row.id)) return;
    let afterId: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (presentIds.has(prevRows[j].id)) {
        afterId = prevRows[j].id;
        break;
      }
    }
    out.push({ id: row.id, title: row.title, afterId });
  });
  return out;
}
