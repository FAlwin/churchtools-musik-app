/**
 * Die Regeln der Lied-Formulare – **anlegen (#322, Schritt 10b) und ändern (Schritt 11)**, rein und
 * damit prüfbar.
 *
 * Warum hier und nicht in den Komponenten: Es sind Entscheidungen, nicht Darstellung. Was ein Doppel
 * ist, wann der Knopf freigibt, was aus dem CCLI-Treffer übernommen wird und **was als Änderung gilt** –
 * genau das sind die Stellen, an denen später eine Korrektur landet. In einer Komponente ließe sich das
 * nur über gerenderte Oberfläche prüfen; hier direkt.
 *
 * **Beide Formulare teilen diese Datei mit Absicht.** Sie zeigen dieselben Felder; zwei Regelsätze
 * nebeneinander wären zwei Stellen, an denen dieselbe Korrektur landen müsste – und die zweite wird
 * vergessen.
 *
 * **Was hier NICHT steht:** die Blockade gegen eine doppelte CCLI-Nummer und die Rechteprüfung. Beides
 * macht der Server (`songVerwaltung.ts`) – eine Prüfung, die nur in der Oberfläche steht, umgeht jeder,
 * der den Endpunkt direkt aufruft. Die Oberfläche zeigt die Meldung des Servers, statt sie
 * vorwegzunehmen.
 */
import type {
  LiedAnlegenAuftrag,
  LiedStammdaten,
  LiedStammdatenAnsicht,
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
export function namensWarnung(
  name: string,
  songs: SongLibraryEntry[],
  eigenesLied?: number,
): string | null {
  const gesucht = name.trim().toLocaleLowerCase('de-DE');
  if (gesucht.length < LIED_GRENZEN.name.min) return null;

  const treffer = songs.filter(
    (s) => s.name.trim().toLocaleLowerCase('de-DE') === gesucht && s.songId !== eigenesLied,
  );
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
        ? 'SongSelect hat für dieses Lied keine Akkorde als ChordPro, nur ein PDF – das Notenblatt musst du in ChurchTools hochladen.'
        : 'SongSelect hat für dieses Lied keine Akkorde – das Notenblatt musst du selbst hinzufügen.',
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

/* ══════════════════════════════════════ Stammdaten ändern (#322, Schritt 11) ══════════════════ */

/**
 * Füllt das Formular aus den gelesenen Stammdaten.
 *
 * `null` wird zu `''` – im Eingabefeld gibt es kein „nicht gesetzt", nur leer. Die Rückrichtung
 * (`aenderungAus`) macht daraus wieder eine Leerung.
 *
 * `key` und `arrangementName` bleiben leer: Sie gehören zum **Arrangement**, nicht zum Lied. Beim
 * Ändern der Stammdaten haben sie deshalb nichts zu suchen – die Tonart eines vorhandenen
 * Arrangements ändert man in ChurchTools oder über die Transposition der App.
 */
export function formularAusLied(lied: LiedStammdatenAnsicht): NeuesLiedFormular {
  return {
    ...LEERES_FORMULAR,
    name: lied.name,
    categoryId: lied.categoryId,
    author: lied.author ?? '',
    ccli: lied.ccli ?? '',
    copyright: lied.copyright ?? '',
  };
}

/**
 * Was sich gegenüber dem gelesenen Stand geändert hat – **nur das wird geschickt.**
 *
 * Drei Zustände, und die Unterscheidung ist der Grund für diese Funktion:
 *  - Feld **fehlt** im Ergebnis = unverändert (der Server behält den Ist-Wert),
 *  - Feld mit **Text** = neuer Wert,
 *  - Feld mit **`''`** = ausdrücklich leeren.
 *
 * Der Server baut daraus einen vollständigen Payload (`songWritePayload`) – nötig, weil ein Teil-`PUT`
 * in ChurchTools die nicht gesendeten Felder löscht (gemessen). Diese Funktion beschreibt also die
 * **Absicht**, nicht den Payload.
 *
 * Ein leeres Ergebnis heißt: Es gibt nichts zu speichern. Die Oberfläche sperrt dann den Knopf, statt
 * einen Schreibvorgang für nichts auszulösen.
 */
export function aenderungAus(
  f: NeuesLiedFormular,
  ist: LiedStammdatenAnsicht,
): Partial<LiedStammdaten> {
  const aenderung: Partial<LiedStammdaten> = {};

  if (f.name.trim() !== ist.name) aenderung.name = f.name.trim();
  if (f.categoryId !== null && f.categoryId !== ist.categoryId) aenderung.categoryId = f.categoryId;

  // Die drei freiwilligen Textfelder: `''` im Formular und `null` im Bestand sind dasselbe – daraus
  // darf keine Änderung entstehen, sonst wäre der Speichern-Knopf immer aktiv.
  for (const feld of ['author', 'ccli', 'copyright'] as const) {
    const neu = f[feld].trim();
    if (neu !== (ist[feld] ?? '')) aenderung[feld] = neu;
  }

  return aenderung;
}

/** Gibt es überhaupt etwas zu speichern? (Leere Änderung = Knopf bleibt gesperrt.) */
export function hatAenderung(f: NeuesLiedFormular, ist: LiedStammdatenAnsicht): boolean {
  return Object.keys(aenderungAus(f, ist)).length > 0;
}

/**
 * Was hat der Nutzer ins CCLI-Suchfeld getippt – einen **Titel** oder eine **CCLI-Nummer**? (#322)
 *
 * Zwei verschiedene Wege bei CCLI: Der Titel geht in die unscharfe Suche (147 Treffer für „Wo ich auch
 * stehe"), die Nummer in die direkte Abfrage – **ein** Treffer, sofort richtig. Wer die Nummer zur Hand
 * hat, soll sie eintippen können.
 *
 * **Nur Ziffern gelten als Nummer.** Ein Liedtitel besteht praktisch nie ausschließlich aus Ziffern;
 * „Psalm 23" enthält Buchstaben und ist damit ein Titel. Der Randfall bleibt: Wer wirklich nach dem
 * Titel „40" suchen will, findet ihn so nicht – die Meldung nennt deshalb beide Wege, statt nur
 * „nichts gefunden" zu sagen.
 *
 * Die Mindestlänge gilt für beide Wege gleich (`SONGSELECT_MIN_ZEICHEN` beim Aufrufer): Kürzere
 * Eingaben ergeben bei CCLI nur Rauschen.
 */
export function sucheArt(
  eingabe: string,
): { art: 'nummer'; nummer: number } | { art: 'titel'; titel: string } {
  const text = eingabe.trim();
  if (/^\d+$/.test(text)) return { art: 'nummer', nummer: Number(text) };
  return { art: 'titel', titel: text };
}

/**
 * Wie viele Stellen eine CCLI-Nummer mindestens hat, damit **von selbst** abgefragt wird.
 *
 * **Gemessen, nicht geraten** (13.08.2026, `probe-songsuche.ts` gegen den Bestand der ECG): Alle 46
 * vergebenen Nummern haben **7 Stellen**. Ohne diese Schwelle würde die Suche beim Tippen einer Nummer
 * schon nach drei Ziffern abfragen und viermal „findet CCLI kein Lied" melden, bevor die Nummer
 * vollständig ist.
 *
 * **Kürzere Nummern sind trotzdem erreichbar** – über den Knopf „Abfragen". Die Schwelle bremst nur die
 * automatische Suche; sie ist eine Beobachtung an einem Bestand, kein Gesetz von CCLI, und darf
 * niemandem den Weg versperren.
 */
export const CCLI_NUMMER_STELLEN_FUER_AUTO = 7;

/**
 * Darf zu dieser Eingabe **von selbst** gesucht werden? (#322)
 *
 * Getrennt von `sucheArt`, weil es eine andere Frage ist: `sucheArt` sagt, **wohin** die Eingabe geht,
 * diese Funktion, **ob** es dafür schon reicht. Beide Regeln liegen hier und nicht in der Komponente –
 * dort wären sie nur durch Anklicken prüfbar.
 *
 * `mindestens` ist die allgemeine Mindestlänge (`SONGSELECT_MIN_ZEICHEN`); sie kommt vom Aufrufer, damit
 * es die Zahl nicht zweimal gibt.
 */
export function automatischSuchen(eingabe: string, mindestens: number): boolean {
  const text = eingabe.trim();
  if (text.length < mindestens) return false;
  const art = sucheArt(text);
  // Eine Nummer erst, wenn sie vollständig aussieht – siehe `CCLI_NUMMER_STELLEN_FUER_AUTO`.
  return art.art === 'titel' || text.length >= CCLI_NUMMER_STELLEN_FUER_AUTO;
}
