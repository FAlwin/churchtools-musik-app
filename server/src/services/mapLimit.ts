/**
 * Führt `fn` über alle Items aus, aber **maximal `limit` gleichzeitig** – das schont die
 * ChurchTools-API (#300).
 *
 * **Warum als eigenes Modul:** Die Funktion stand privat in `setlistBuilder.ts` und wurde vom
 * Statistik-Lauf benutzt. Mit dem Suchindex über die Liedtexte (#322) kam ein zweiter Nutzer – und
 * damit die Wahl zwischen einer Kopie und einem Import aus einem Modul, das fachlich etwas anderes
 * tut. Beides wäre falsch; also liegt sie hier.
 *
 * Bewusst ohne Rückgabewert: Beide Nutzer sammeln ihr Ergebnis selbst ein (die Statistik in einem
 * Objekt, der Index in einer Liste). Ein `Promise<R[]>` daraus zu machen, hieße die Reihenfolge zu
 * versprechen, die keiner von beiden braucht.
 */
export async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}
