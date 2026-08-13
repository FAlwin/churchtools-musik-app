/**
 * Lieder **anlegen, ändern und löschen** (#322, Schritte 10 und 11).
 *
 * Die drei Vorgänge stehen zusammen, weil sie sich die Prüfungen teilen: das Recht an der Kategorie
 * und die Blockade gegen eine doppelte CCLI-Nummer. Getrennte Dateien hätten diese Regeln zweimal
 * gehabt – und die zweite Fassung wäre bei der nächsten Korrektur vergessen worden.
 *
 * **Ein Lied anlegen sind zwei bis drei Schreibvorgänge, die einzeln scheitern können.** Ein Lied
 * entsteht nicht in einem Zug:
 *
 *  1. `POST /api/songs` – das Lied,
 *  2. `POST …/arrangements` – **ohne Arrangement ist ein Lied unbrauchbar**,
 *  3. optional der Eintrag im Ablauf eines Termins.
 *
 * ChurchTools kennt dafür keine Transaktion. Scheitert Schritt 2, liegt in ChurchTools ein Lied ohne
 * Arrangement – und **genau das muss die App sagen**, statt einen Fehler zu melden, der aussieht, als
 * wäre nichts passiert. Wer dann „nochmal" drückt, legt sonst ein zweites Lied an.
 *
 * **Nichts wird automatisch wiederholt und nichts automatisch zurückgenommen.** Ein Wiederholversuch
 * verdoppelt (`schreibe` ist bewusst ohne, siehe dort). Und ein automatisches Löschen des eben
 * angelegten Liedes wäre die schlechtere Wahl: Der Datensatz existiert, jemand könnte ihn schon
 * sehen, und ein Aufräumen, das selbst scheitert, hinterlässt einen noch unklareren Zustand.
 */
import type { LiedAngelegt, LiedAnlegenAuftrag } from '@shared/types/index';
import { HttpError } from '../middleware/errorHandler.js';
import { getAllSongs, getSong } from './ctRead.js';
import { getEditableSongCategories } from './ctSongCategories.js';
import {
  createAgendaItem,
  createArrangement,
  createSong,
  deleteSong,
  updateSong,
} from './ctWrite.js';
import type { SongOverrides } from './songPayload.js';
import type { CtSong } from './ctTypes.js';

/**
 * Auftrag und Ergebnis stehen in `@shared/types` – **die Oberfläche schickt das eine und liest das
 * andere.** Zwei Fassungen (hier und im Client) wären zwei Stellen für dieselbe Absprache.
 */
export type { LiedAngelegt, LiedAnlegenAuftrag };

/**
 * Prüft, ob der Nutzer in dieser Kategorie arbeiten darf – **serverseitig, nicht nur im Formular**.
 *
 * Die Oberfläche bietet ohnehin nur erlaubte Kategorien an. Das ist aber keine Prüfung, sondern
 * Bequemlichkeit: Wer den Endpunkt direkt aufruft, umgeht sie. Benutzt wird dieselbe Funktion, die
 * auch die Auswahl füllt – zwei Fassungen derselben Regel wären zwei Stellen, die auseinanderlaufen.
 *
 * **Beim Ändern wird sie zweimal aufgerufen** (#322, Schritt 11): einmal für die Kategorie, in der das
 * Lied liegt, und einmal für die, in die es soll. Wer nur an einer von beiden Rechte hat, könnte ein
 * Lied sonst aus einem Bereich herausholen, den er nicht bearbeiten darf – oder in einen hinein.
 */
async function pruefeKategorie(cookie: string, categoryId: number, was = 'anlegen'): Promise<void> {
  const erlaubt = await getEditableSongCategories(cookie);
  if (!erlaubt.some((k) => k.id === categoryId)) {
    throw new HttpError(403, `In dieser Kategorie darfst du keine Lieder ${was}.`);
  }
}

/**
 * Blockiert ein zweites Lied mit **derselben CCLI-Nummer** (Entscheidung Alwin, 13.08.2026).
 *
 * **Verglichen wird getrimmter Text, nie eine Zahl.** ChurchTools liefert `ccli` als Zeichenkette
 * (`"5841527"`); als Zahl gelesen verlöre eine Nummer mit führender Null ihre Identität, und
 * `Number('')` wäre `0` – also ein Treffer bei jedem Lied ohne Nummer.
 *
 * **Über `getAllSongs`, NICHT über `getSongLibrary`.** Die Bibliothek wirft Lieder **ohne
 * Arrangement** weg – und genau so eines entsteht, wenn Schritt 2 oben scheitert. Der zweite Versuch
 * würde das eben angelegte Lied dann nicht finden und ein Doppel erzeugen: die Blockade wäre
 * ausgerechnet in dem Fall blind, für den sie am nötigsten ist.
 *
 * Kein zusätzlicher Aufwand für ChurchTools: Die Liedliste ist ein paar Seitenabrufe, kein Abruf je
 * Lied (das wären ~250 und damit #300).
 *
 * **`eigenesLied` ist der Grund, warum diese Funktion beim Ändern nicht kopiert wurde** (#322, Schritt
 * 11): Dort trägt das Lied seine Nummer schon selbst. Ohne diese Ausnahme könnte man ein Lied nicht
 * mehr speichern, sobald es eine CCLI-Nummer hat – es wäre sein eigenes Doppel.
 */
async function pruefeDoppel(
  cookie: string,
  ccli: string | undefined,
  eigenesLied?: number,
): Promise<void> {
  const nummer = ccli?.trim();
  if (!nummer) return; // Ohne Nummer gibt es nichts sicher zu vergleichen – der Client warnt beim Namen.

  const songs = await getAllSongs(cookie);
  const treffer = songs.find((s) => String(s.ccli ?? '').trim() === nummer && s.id !== eigenesLied);
  if (treffer) {
    throw new HttpError(
      409,
      `Die CCLI-Nummer ${nummer} hat schon „${treffer.name}". ` +
        (eigenesLied === undefined
          ? 'Dasselbe Lied ein zweites Mal anzulegen würde das Team verwirren – ergänze lieber ein ' +
            'Arrangement am vorhandenen Lied.'
          : 'Zwei Lieder mit derselben Nummer wären nicht mehr auseinanderzuhalten.'),
    );
  }
}

/**
 * Legt Lied + Arrangement an (und trägt es auf Wunsch in einen Ablauf ein).
 *
 * **Am Ende wird nachgesehen, nicht geglaubt.** Der abschließende `getSong` ist kein Zierrat: Er
 * belegt, dass beides wirklich existiert – die Lehre vom 11.08.2026, als ein `status: success` ohne
 * entstandene Datei zwei Notenblätter gekostet hat. Er kostet nichts extra, weil die Antwort ohnehin
 * gebraucht wird, um das fertige Lied zu öffnen.
 */
export async function liedAnlegen(
  cookie: string,
  auftrag: LiedAnlegenAuftrag,
): Promise<LiedAngelegt> {
  await pruefeKategorie(cookie, auftrag.categoryId);
  await pruefeDoppel(cookie, auftrag.ccli);

  const songId = await createSong(cookie, {
    name: auftrag.name,
    categoryId: auftrag.categoryId,
    author: auftrag.author,
    ccli: auftrag.ccli,
    copyright: auftrag.copyright,
  });

  let arrangementId: number;
  try {
    arrangementId = await createArrangement(cookie, songId, {
      name: auftrag.arrangementName?.trim() || 'Standard',
      key: auftrag.key,
      isDefault: true,
    });
  } catch (err) {
    /**
     * **Der Zwischenzustand wird benannt, nicht verschluckt.** In ChurchTools liegt jetzt ein Lied
     * ohne Arrangement. Ein bloßes „Anlegen fehlgeschlagen" würde den Nutzer dazu bringen, es erneut
     * zu versuchen – und dann läge es zweimal da.
     */
    const grund = err instanceof Error ? err.message : String(err);
    throw new HttpError(
      502,
      `„${auftrag.name}" wurde in ChurchTools angelegt, aber ohne Arrangement – und ohne eines ist ` +
        `ein Lied nicht benutzbar. Bitte in ChurchTools ein Arrangement ergänzen oder das Lied dort ` +
        `löschen; ein zweiter Versuch hier würde es doppelt anlegen. (${grund})`,
    );
  }

  // Nachsehen statt glauben: Existiert das Lied wirklich, und hängt das Arrangement daran?
  const song = await getSong(cookie, songId);
  if (!song.arrangements.some((a) => a.id === arrangementId)) {
    throw new HttpError(
      502,
      `„${auftrag.name}" wurde angelegt, aber ChurchTools zeigt das Arrangement nicht an. Bitte dort ` +
        'nachsehen, bevor du es erneut versuchst.',
    );
  }

  if (auftrag.eventId === undefined) return { songId, arrangementId };

  /**
   * **Der Ablauf-Eintrag ist der dritte Schreibvorgang – und ein Fehlschlag ist kein Gesamtfehler.**
   *
   * Das Lied existiert an dieser Stelle mitsamt Arrangement; es wäre falsch, das als gescheitert zu
   * melden, nur weil der Eintrag im Termin nicht geklappt hat. Der Nutzer erfährt beides: dass das
   * Lied da ist und dass es noch nicht im Ablauf steht.
   */
  try {
    await createAgendaItem(cookie, auftrag.eventId, {
      type: 'song',
      title: auftrag.name,
      arrangementId,
    });
    return { songId, arrangementId, imAblauf: true };
  } catch (err) {
    return {
      songId,
      arrangementId,
      imAblauf: false,
      ablaufFehler: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Ändert die Stammdaten eines Liedes (#322, Schritt 11).
 *
 * **Drei Prüfungen, alle serverseitig** – und alle über dieselben Funktionen wie beim Anlegen:
 *
 *  1. **Das Recht an der Kategorie, in der das Lied HEUTE liegt.** Ohne sie könnte jemand ein Lied
 *     ändern, das in einem Bereich liegt, den er gar nicht bearbeiten darf.
 *  2. **Das Recht an der Ziel-Kategorie**, falls verschoben wird. Sonst ließe sich ein Lied in einen
 *     Bereich hineinschieben, für den man keine Rechte hat.
 *  3. **Die CCLI-Nummer**, mit Ausnahme des eigenen Liedes (siehe `pruefeDoppel`).
 *
 * Der eigentliche Schreibvorgang ist **lesen–ändern–schreiben** (`updateSong`), weil ein Teil-`PUT`
 * die übrigen Felder löscht – gemessen, siehe `songPayload.ts`.
 */
export async function liedAendern(
  cookie: string,
  songId: number,
  aenderung: SongOverrides,
): Promise<CtSong> {
  const song = await getSong(cookie, songId);

  const heute = song.category?.id;
  if (typeof heute === 'number') await pruefeKategorie(cookie, heute, 'ändern');
  if (aenderung.categoryId !== undefined && aenderung.categoryId !== heute) {
    await pruefeKategorie(cookie, aenderung.categoryId, 'ablegen');
  }
  await pruefeDoppel(cookie, aenderung.ccli, songId);

  // Das gelesene Lied wird weitergegeben: Es ist gerade frisch geholt, ein zweites Lesen wäre eine
  // ChurchTools-Anfrage für nichts (#300).
  return updateSong(cookie, songId, aenderung, song);
}

/**
 * Löscht ein Lied (#322, Schritt 11) – **mit dem Recht an SEINER Kategorie, nicht an irgendeiner.**
 *
 * Die Rückfrage in der Oberfläche nennt die Folgen; hier wird geprüft, ob der Nutzer dieses Lied
 * überhaupt anfassen darf. Und der Liedname wird **vorher gelesen**: Danach gibt es ihn nicht mehr,
 * die App braucht ihn aber für die Meldung „… wurde gelöscht".
 */
export async function liedLoeschen(cookie: string, songId: number): Promise<{ name: string }> {
  const song = await getSong(cookie, songId);
  const kategorie = song.category?.id;
  if (typeof kategorie === 'number') await pruefeKategorie(cookie, kategorie, 'löschen');

  await deleteSong(cookie, songId);
  return { name: song.name };
}
