/**
 * Bestandsnotizen dem geltenden Arrangement zuschlagen (#320, Schritt 2).
 *
 * **Die Ausgangslage:** Bis zur Einführung des Arrangement-Segments hingen Anmerkungen an
 * Lied + Version + Darstellungsart. Welches Arrangement dabei im Spiel war, stand nirgends – es gab
 * ja auch nur eines je Lied und Ablauf. Sobald sich umschalten lässt, muss diese Frage beantwortet
 * werden, und die Antwort ist eine Entscheidung: **Alte Notizen gehören zu dem Arrangement, das
 * gerade gilt.**
 *
 * **Kopieren, nicht umbenennen.** Der Altbestand bleibt liegen. Das kostet etwas Speicher und ist
 * den Preis wert: Dasselbe Lied kann in einem anderen Gottesdienst ein anderes Arrangement gehabt
 * haben – dort wären die Notizen sonst weg, ohne dass jemand sie zurückholen könnte. Ein
 * Umbenennen ist nicht umkehrbar, ein Kopieren schon.
 *
 * **Nichts überschreiben.** Gibt es zum Ziel-Schlüssel schon etwas, wird nicht kopiert. Sonst
 * überschriebe ein später nachgezogener Altbestand die Notizen, die man für dieses Arrangement
 * bereits angelegt hat.
 *
 * Rein und ohne Speicherzugriff – die Anwendung steht in `arrangementMigrationAnwenden`.
 */

/** Ein Kopiervorgang: derselbe Inhalt unter einem zusätzlichen Schlüssel. */
export interface Kopie {
  von: string;
  nach: string;
}

/**
 * Erkennt einen Schlüssel dieses Lieds OHNE Arrangement-Segment.
 *
 * Bewusst über den Namensraum hinweg: Striche (`worship_docdraw_`), Textobjekte (`…_text`) und
 * Zoom-Ausschnitte (`worship_doczoom_…_dlarge2`) folgen alle derselben Grammatik. Was hinter der
 * Version steht, interessiert nicht – es wird unverändert mitgenommen.
 */
function ohneArrangement(schluessel: string, songId: number): RegExpMatchArray | null {
  return schluessel.match(new RegExp(`^(.*song${songId})(_v[a-z0-9-]+(?:_lyr)?_.*)$`, 'i'));
}

/**
 * Welche Schlüssel müssen kopiert werden, damit die Bestandsnotizen dieses Lieds unter dem
 * geltenden Arrangement zu finden sind?
 *
 * `vorhanden` sind ALLE Schlüssel im Speicher (mit Namensraum). Zurück kommen nur die Kopien, die
 * wirklich nötig sind – bereits arrangement-genaue Schlüssel und schon belegte Ziele bleiben außen
 * vor.
 */
export function arrangementKopien(
  vorhanden: string[],
  songId: number,
  arrangementId: number,
): Kopie[] {
  const belegt = new Set(vorhanden);
  const kopien: Kopie[] = [];
  const seg = `_a${arrangementId}`;

  for (const von of vorhanden) {
    // Ein bereits arrangement-genauer Schlüssel fällt hier von selbst heraus: Hinter der Lied-ID
    // folgt bei ihm `_a46_`, das Muster verlangt aber `_v`. Ein zusätzlicher Vorbehalt stand hier
    // zunächst – die Gegenprobe zeigte, dass er nie greift. Toter Code an dieser Stelle wäre
    // besonders tückisch: Er sähe aus wie der Schutz, der die Notizen fremder Arrangements bewacht.
    const m = ohneArrangement(von, songId);
    if (!m) continue;
    const nach = `${m[1]}${seg}${m[2]}`;
    if (belegt.has(nach)) continue;
    kopien.push({ von, nach });
  }
  return kopien;
}

/**
 * Die Kopien wirklich anlegen. Gibt zurück, wie viele es waren.
 *
 * **Muss laufen, BEVOR Seiten gezeichnet werden.** Seit die Schlüssel das Arrangement tragen, sucht
 * die App unter dem neuen – der Bestand liegt unter dem alten. Ohne diesen Schritt sähe ein
 * Bestandsnutzer seine Notizen als verschwunden an.
 *
 * Idempotent: Ein zweiter Lauf findet nichts mehr (siehe `arrangementKopien`). Deshalb braucht es
 * keinen Merker, der irgendwann nicht mehr zum Zustand passt – der Speicher selbst ist der Merker.
 */
export function arrangementMigrationAnwenden(songId: number, arrangementId: number): number {
  const vorhanden: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) vorhanden.push(k);
  }
  const kopien = arrangementKopien(vorhanden, songId, arrangementId);
  for (const { von, nach } of kopien) {
    const wert = localStorage.getItem(von);
    // Erst prüfen, dann schreiben: Ein zwischenzeitlich entfernter Schlüssel darf keinen leeren
    // Eintrag hinterlassen – der sähe wie „hier wurde bewusst nichts gezeichnet" aus und würde
    // späteres Nachziehen blockieren.
    if (wert !== null) localStorage.setItem(nach, wert);
  }
  return kopien.length;
}
