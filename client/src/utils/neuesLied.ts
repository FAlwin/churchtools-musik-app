/**
 * Die Regeln des Formulars „Neues Lied" (#322, Schritt 10b) – **rein und damit prüfbar.**
 *
 * Warum hier und nicht in der Komponente: Es sind Entscheidungen, nicht Darstellung. Was ein Doppel
 * ist, wann der Knopf freigibt und was aus dem CCLI-Treffer ins Formular übernommen wird – genau das
 * sind die Stellen, an denen später eine Korrektur landet. In einer Komponente ließe sich das nur
 * über gerenderte Oberfläche prüfen; hier direkt.
 *
 * **Was hier NICHT steht:** die Blockade gegen eine doppelte CCLI-Nummer und die Rechteprüfung. Beides
 * macht der Server (`songErstellen.ts`) – eine Prüfung, die nur in der Oberfläche steht, umgeht jeder,
 * der den Endpunkt direkt aufruft. Die Oberfläche zeigt die Meldung des Servers, statt sie
 * vorwegzunehmen.
 */
import type {
  LiedAnlegenAuftrag,
  SongLibraryEntry,
  SongSelectSong,
  SongSelectTreffer,
} from '@shared/types/index';
import { LIED_GRENZEN } from '@shared/types/index';

/** Der Stand des Formulars – alle Felder als Text, so wie sie in den Eingabefeldern stehen. */
export interface NeuesLiedFormular {
  name: string;
  /** `null` = noch keine gewählt. Kategorie **0** ist echt, deshalb nicht `0` als „leer". */
  categoryId: number | null;
  author: string;
  ccli: string;
  copyright: string;
  key: string;
  /** Leer = „Standard" (das benennt der Server, nicht das Formular). */
  arrangementName: string;
}

/** Ein leeres Formular. Die Kategorie bleibt bewusst offen (Entscheidung Alwin, 13.08.2026). */
export const LEERES_FORMULAR: NeuesLiedFormular = {
  name: '',
  categoryId: null,
  author: '',
  ccli: '',
  copyright: '',
  key: '',
  arrangementName: '',
};

/**
 * Übernimmt einen CCLI-Treffer ins Formular – **ohne die Kategorie zu berühren.**
 *
 * Die Kategorie ist Pflichtfeld ohne Vorbelegung; hätte ein Treffer sie gesetzt, wäre die Entscheidung
 * dem Nutzer aus der Hand genommen. Eine bereits gewählte Kategorie bleibt deshalb stehen, wenn man
 * einen anderen Treffer anklickt.
 *
 * `copyright` kennt nur die Einzelabfrage (`SongSelectSong`); bei einem Treffer aus der Liste bleibt
 * das Feld leer, statt mit einem Platzhalter zu füllen.
 */
export function formularAusTreffer(
  treffer: SongSelectTreffer | SongSelectSong,
  bisher: NeuesLiedFormular = LEERES_FORMULAR,
): NeuesLiedFormular {
  return {
    ...bisher,
    name: treffer.title,
    author: treffer.authors.join(', '),
    ccli: String(treffer.songNumber),
    copyright: 'copyright' in treffer ? (treffer.copyright ?? '') : '',
    key: treffer.defaultKey ?? '',
  };
}

/**
 * Ist das Formular vollständig genug zum Absenden?
 *
 * Nur die beiden **Pflichtangaben**: ein Name mit Mindestlänge und eine gewählte Kategorie. Die
 * Längen-Obergrenzen prüft das Formular nicht nach – die Eingabefelder begrenzen sie über
 * `LIED_GRENZEN`, und der Server lehnt ab, was trotzdem zu lang ankommt.
 */
export function formularBereit(f: NeuesLiedFormular): boolean {
  return f.name.trim().length >= LIED_GRENZEN.name.min && f.categoryId !== null;
}

/**
 * Warnt, wenn schon ein Lied so heißt – **warnt nur, blockiert nicht** (Entscheidung Alwin,
 * 13.08.2026).
 *
 * Gleiche Namen sind bei Liedern normal: verschiedene Fassungen, Übersetzungen, ein deutscher und ein
 * englischer Text. Blockiert wird nur die gleiche **CCLI-Nummer**, und das macht der Server.
 *
 * Verglichen wird getrimmt und ohne Groß-/Kleinschreibung, weil „Treu" und „treu " dasselbe Lied
 * meinen. `null`, solange der Name zu kurz zum Vergleichen ist.
 */
export function namensWarnung(name: string, songs: SongLibraryEntry[]): string | null {
  const gesucht = name.trim().toLocaleLowerCase('de-DE');
  if (gesucht.length < LIED_GRENZEN.name.min) return null;

  const treffer = songs.filter((s) => s.name.trim().toLocaleLowerCase('de-DE') === gesucht);
  if (treffer.length === 0) return null;

  return treffer.length === 1
    ? `„${treffer[0].name}" gibt es schon. Anlegen geht trotzdem – gemeint ist dann ein zweites, eigenes Lied.`
    : `${treffer.length} Lieder heißen schon so. Anlegen geht trotzdem – gemeint ist dann ein weiteres, eigenes Lied.`;
}

/**
 * Baut den Auftrag für den Server – **leere Felder werden weggelassen, nicht als `""` gesendet.**
 *
 * Der Grund steht in `createSong`: ChurchTools soll seine Vorgaben behalten, statt sie mit einer
 * leeren Zeichenkette zu überschreiben.
 *
 * `categoryId` ist hier Pflicht; dass sie gewählt ist, stellt `formularBereit` sicher – deshalb nimmt
 * diese Funktion sie als Zahl und nicht als „vielleicht null" (ein `?? 0` wäre stillschweigend die
 * Kategorie „Aktive Songs" gewesen).
 */
export function auftragAus(
  f: NeuesLiedFormular,
  categoryId: number,
  eventId?: number,
): LiedAnlegenAuftrag {
  const auftrag: LiedAnlegenAuftrag = { name: f.name.trim(), categoryId };
  if (f.author.trim()) auftrag.author = f.author.trim();
  if (f.ccli.trim()) auftrag.ccli = f.ccli.trim();
  if (f.copyright.trim()) auftrag.copyright = f.copyright.trim();
  if (f.key.trim()) auftrag.key = f.key.trim();
  if (f.arrangementName.trim()) auftrag.arrangementName = f.arrangementName.trim();
  if (eventId !== undefined) auftrag.eventId = eventId;
  return auftrag;
}

/**
 * Soll nach dem Anlegen das Notenblatt aus SongSelect geholt werden? (#322)
 *
 * **Automatisch, weil bei einem neuen Lied nichts überschrieben werden kann** (Entscheidung Alwin,
 * 13.08.2026): Das Arrangement ist gerade entstanden und hat kein ChordPro – der Grund, warum der
 * Knopf in der Dateiverwaltung nur ohne Notenblatt erscheint, greift hier also nicht. Und der Download
 * ist nicht idempotent: Ein zweiter Aufruf legte eine zweite gleichnamige Datei an.
 *
 * Drei Antworten, und die dritte ist der Grund für diese Funktion:
 *  - `{ songNumber }` – holen,
 *  - `null` – nichts zu holen und nichts zu sagen (keine Nummer oder keine SongSelect-Lizenz),
 *  - `{ grund }` – **nicht holen, aber sagen warum.** Wenn CCLI für dieses Lied gar keine Akkorde hat,
 *    wäre der Aufruf ein sicherer Fehlschlag; dann ist ein ruhiger Satz besser als eine Fehlermeldung.
 */
export function notenblattPlan(
  f: NeuesLiedFormular,
  treffer: SongSelectTreffer | null,
  canUseCcli: boolean,
): { songNumber: number } | { grund: string } | null {
  const nummer = Number(f.ccli.trim());
  if (!canUseCcli || !Number.isInteger(nummer) || nummer <= 0) return null;

  // Nur wenn der Treffer zur eingetippten Nummer gehört, wissen wir etwas über die Formate. Wer die
  // Nummer selbst eingibt, bekommt einen Versuch – ein Fehlschlag kostet nur einen Hinweis.
  if (treffer && treffer.songNumber === nummer && !treffer.hasChordPro) {
    return {
      grund: treffer.hasChordSheet
        ? 'CCLI hat für dieses Lied keine Akkorde als ChordPro, nur ein PDF – das Notenblatt musst du in ChurchTools hochladen.'
        : 'CCLI hat für dieses Lied keine Akkorde – das Notenblatt musst du selbst hinzufügen.',
    };
  }
  return { songNumber: nummer };
}

/**
 * Die Unterzeile eines CCLI-Treffers: Autoren · Nummer · was CCLI dazu hergibt.
 *
 * **Die Merkmale sind nötig, weil die Suche unscharf ist** (147 Treffer für „Wo ich auch stehe",
 * gemessen). Ohne Autor und Nummer stehen in der Liste zwanzig Zeilen mit demselben Titel.
 *
 * „Akkorde" meint das ChordPro, das die App danach holt – deshalb steht es hier und nicht nur als
 * Häkchen: Ohne Akkorde bekommt das Lied kein Notenblatt.
 */
export function trefferUnterzeile(t: SongSelectTreffer): string {
  const teile: string[] = [];
  if (t.authors.length > 0) teile.push(t.authors.join(', '));
  teile.push(`Nr. ${t.songNumber}`);
  if (t.hasChordPro) teile.push('Akkorde');
  else if (t.hasChordSheet) teile.push('nur Notenblatt (PDF)');
  else if (t.hasLyrics) teile.push('nur Text');
  if (t.isPublicDomain) teile.push('gemeinfrei');
  return teile.join(' · ');
}
