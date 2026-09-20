/**
 * **Arrangements verwalten** – anlegen, ändern, zum Standard machen, löschen (#396).
 *
 * Alwins Wunsch vom 19.09.2026: Was der ChurchTools-Dialog „Arrangement bearbeiten" kann, soll auch
 * in der App gehen – Name, Quelle, Liednummer, Tonart, Tempo, Takt, Länge, Beschreibung, dazu „zum
 * Standard machen" und „entfernen". Alle acht Felder sind an der Test-Instanz gemessen
 * (`server/scripts/probe-arrangements.ts` und `-alt.ts`), zwei davon erst im zweiten Anlauf: Der
 * Standard wechselt über `PATCH …/default`, die Quelle braucht eine **gültige** ID aus
 * `getMasterData → songsource` (eine ungültige verwirft ChurchTools stillschweigend).
 *
 * **Die Prüfungen stehen hier, nicht in der Oberfläche** – dieselbe Linie wie bei der
 * Liedverwaltung (`songVerwaltung.ts`), und aus demselben Grund: Wer den Endpunkt direkt aufruft,
 * umgeht ein Formular. Benutzt wird dafür `pruefeKategorie` aus der Liedverwaltung, nicht eine
 * zweite Fassung derselben Regel.
 *
 * **Zwei Geländer, die ChurchTools selbst nicht hat:**
 *
 *  1. **Das letzte Arrangement lässt sich nicht löschen.** Ein Lied ohne Arrangement ist unbrauchbar
 *     – das steht schon beim Anlegen so (`songVerwaltung.ts`) und gilt hier genauso.
 *  2. **Das Standard-Arrangement lässt sich nicht löschen, solange es andere gibt.** Sonst stünde
 *     das Lied ohne Standard da, und jede Stelle, die sich auf `isDefault` verlässt, fiele auf
 *     „irgendeines" zurück. Wer es loswerden will, macht zuerst ein anderes zum Standard – ein
 *     Klick mehr, dafür kein stiller Zwischenzustand.
 */
import type { ArrangementAnsicht, ArrangementAuftrag } from '@shared/types/index';
import { HttpError } from '../middleware/errorHandler.js';
import { getSong } from './ctRead.js';
import { nummerOhneQuelle, type ArrangementOverrides } from './arrangementPayload.js';
import {
  createArrangement,
  deleteArrangement,
  setDefaultArrangement,
  updateArrangement,
} from './ctWrite.js';
import { getSongSources } from './ctSongSources.js';
import { pruefeKategorie } from './songVerwaltung.js';
import type { CtArrangement, CtSong } from './ctTypes.js';

/**
 * Ein Arrangement für die App – **eine Abbildung, für alle Antworten dieses Dienstes.**
 *
 * Die Zahlen kommen aus ChurchTools mal als Zahl, mal als Zeichenkette (`bpm` ist der bekannte Fall,
 * siehe `CtArrangement`). Umgerechnet wird deshalb genau hier, nicht bei jedem Aufrufer.
 */
function ansicht(arr: CtArrangement): ArrangementAnsicht {
  const tempoRoh = arr.tempo ?? arr.bpm;
  const tempo =
    typeof tempoRoh === 'number'
      ? tempoRoh
      : typeof tempoRoh === 'string' && tempoRoh.trim() !== ''
        ? Number(tempoRoh)
        : null;

  const quelle = arr.source ?? null;
  return {
    id: arr.id,
    name: arr.name,
    isDefault: arr.isDefault === true,
    key: arr.key ?? arr.keyOfArrangement ?? null,
    tempo: tempo !== null && Number.isFinite(tempo) ? tempo : null,
    beat: arr.beat ?? null,
    duration: typeof arr.duration === 'number' ? arr.duration : null,
    // `note` ist ChurchTools' alter Name für dasselbe Feld – siehe `arrangementPayload.ts`.
    description: arr.description ?? arr.note ?? null,
    source:
      quelle && typeof quelle.id === 'number'
        ? { id: quelle.id, name: quelle.name ?? '', shorty: quelle.shorty ?? '' }
        : null,
    sourceReference: arr.sourceReference ?? null,
    dateien: arr.files.length,
  };
}

/**
 * Liest das Lied, prüft das Recht an **seiner** Kategorie und liefert beides zurück.
 *
 * Steht hier einmal, weil jeder der vier Vorgänge damit beginnt. Der gelesene Stand wird
 * weitergereicht – ein zweites `getSong` wäre eine ChurchTools-Anfrage für nichts (#300).
 */
async function liedMitRecht(cookie: string, songId: number, was: string): Promise<CtSong> {
  const song = await getSong(cookie, songId);
  const kategorie = song.category?.id;
  if (typeof kategorie === 'number') await pruefeKategorie(cookie, kategorie, was);
  return song;
}

/** Sucht ein Arrangement im gelesenen Lied – oder sagt sauber, dass es das nicht gibt. */
function findeArrangement(song: CtSong, arrangementId: number): CtArrangement {
  const arr = song.arrangements.find((a) => a.id === arrangementId);
  if (!arr) throw new HttpError(404, 'Dieses Arrangement gibt es in ChurchTools nicht (mehr).');
  return arr;
}

/**
 * Prüft die Quelle, **bevor** geschrieben wird (#396).
 *
 * Zwei Dinge, die ChurchTools beide **stillschweigend** hinnimmt und dabei verwirft:
 *
 *  1. Eine Liednummer ohne Quelle (gemessen: 200, danach `null`). Die Rechnung dazu steht in
 *     `nummerOhneQuelle` – hier wird nur der Satz für den Nutzer daraus gemacht.
 *  2. Eine **unbekannte** Quellen-ID (gemessen: 200, danach `null`). Deshalb wird gegen die echte
 *     Liste geprüft – „ich habe es geschickt" ist kein Beleg, dass es angekommen ist.
 */
async function pruefeQuelle(
  cookie: string,
  arr: CtArrangement,
  auftrag: ArrangementOverrides,
): Promise<void> {
  if (nummerOhneQuelle(arr, auftrag)) {
    throw new HttpError(
      400,
      'Eine Liednummer speichert ChurchTools nur zusammen mit einer Quelle. Bitte erst das ' +
        'Liederbuch auswählen – oder die Nummer weglassen.',
    );
  }
  if (auftrag.sourceId === undefined || auftrag.sourceId === null) return;

  const quellen = await getSongSources(cookie);
  if (!quellen.some((q) => q.id === auftrag.sourceId)) {
    throw new HttpError(
      400,
      'Diese Quelle kennt ChurchTools nicht. Bitte die Seite neu laden – die Liste der Liederbücher ' +
        'hat sich vermutlich geändert.',
    );
  }
}

/** Alle Arrangements eines Liedes – für das Stammdaten-Blatt (#396). */
export async function arrangementsLesen(
  cookie: string,
  songId: number,
): Promise<ArrangementAnsicht[]> {
  const song = await getSong(cookie, songId);
  return song.arrangements.map(ansicht);
}

/**
 * Legt ein weiteres Arrangement an (#396).
 *
 * **Nie als Standard:** Ein neues Arrangement soll dem Team nicht ungefragt das gewohnte vor der
 * Nase wegnehmen. Wer es zum Standard machen will, sagt das eigens – ein zweiter, sichtbarer Schritt.
 *
 * **Am Ende wird nachgesehen, nicht geglaubt** – dieselbe Lehre wie beim Lied-Anlegen (11.08.2026):
 * Ein `201` mit ID ist noch kein Beleg, dass das Arrangement am Lied hängt.
 */
export async function arrangementAnlegen(
  cookie: string,
  songId: number,
  auftrag: ArrangementAuftrag & { name: string },
): Promise<ArrangementAnsicht> {
  await liedMitRecht(cookie, songId, 'ändern');

  // Ein leeres Arrangement als Bezug: Beim Anlegen gibt es keinen Ist-Zustand, die Quelle-Regel
  // gilt trotzdem.
  const leer: CtArrangement = {
    id: 0,
    name: auftrag.name,
    key: null,
    keyOfArrangement: null,
    bpm: null,
    beat: null,
    files: [],
  };
  await pruefeQuelle(cookie, leer, auftrag);

  const neueArrId = await createArrangement(cookie, songId, { ...auftrag, isDefault: false });

  const danach = await getSong(cookie, songId);
  const arr = danach.arrangements.find((a) => a.id === neueArrId);
  if (!arr) {
    throw new HttpError(
      502,
      `Das Arrangement „${auftrag.name}" wurde angelegt, aber ChurchTools zeigt es nicht am Lied an. ` +
        'Bitte dort nachsehen, bevor du es erneut versuchst.',
    );
  }
  return ansicht(arr);
}

/**
 * Ändert ein Arrangement (#396).
 *
 * Der Schreibvorgang ist lesen–ändern–schreiben (`updateArrangement`), weil ein Teil-`PUT` die
 * übrigen Felder löscht – gemessen, siehe `arrangementPayload.ts`. Zurück kommt der Stand, den
 * ChurchTools **danach** liefert, nicht das, was das Formular geschickt hat.
 */
export async function arrangementAendern(
  cookie: string,
  songId: number,
  arrangementId: number,
  auftrag: ArrangementAuftrag,
): Promise<ArrangementAnsicht> {
  const song = await liedMitRecht(cookie, songId, 'ändern');
  const arr = findeArrangement(song, arrangementId);
  await pruefeQuelle(cookie, arr, auftrag);

  await updateArrangement(cookie, songId, arrangementId, auftrag);

  const danach = await getSong(cookie, songId);
  return ansicht(findeArrangement(danach, arrangementId));
}

/**
 * Macht ein Arrangement zum Standard (#396).
 *
 * **Nachgesehen wird ausdrücklich**, weil ChurchTools hier schon einmal gelogen hat: Ein `PUT` mit
 * `isDefault: true` antwortet 200 und ändert nichts (gemessen 20.09.2026). Der richtige Weg ist
 * `PATCH …/default`; dass er gewirkt hat, belegt erst der Stand danach.
 */
export async function arrangementZumStandard(
  cookie: string,
  songId: number,
  arrangementId: number,
): Promise<ArrangementAnsicht[]> {
  const song = await liedMitRecht(cookie, songId, 'ändern');
  findeArrangement(song, arrangementId);

  await setDefaultArrangement(cookie, songId, arrangementId);

  const danach = await getSong(cookie, songId);
  const jetzt = findeArrangement(danach, arrangementId);
  if (jetzt.isDefault !== true) {
    throw new HttpError(
      502,
      `ChurchTools hat den Standard nicht auf „${jetzt.name}" umgestellt. Bitte dort nachsehen.`,
    );
  }
  return danach.arrangements.map(ansicht);
}

/**
 * Löscht ein Arrangement (#396) – mit den beiden Geländern aus dem Kopf dieser Datei.
 *
 * Der Name wird **vorher** gelesen: Danach gibt es ihn nicht mehr, die Meldung braucht ihn aber –
 * dieselbe Überlegung wie beim Löschen eines Liedes.
 */
export async function arrangementLoeschen(
  cookie: string,
  songId: number,
  arrangementId: number,
): Promise<{ name: string }> {
  const song = await liedMitRecht(cookie, songId, 'ändern');
  const arr = findeArrangement(song, arrangementId);

  if (song.arrangements.length <= 1) {
    throw new HttpError(
      409,
      'Das ist das einzige Arrangement des Liedes. Ohne Arrangement wäre das Lied nicht mehr ' +
        'benutzbar – lege erst ein weiteres an.',
    );
  }
  if (arr.isDefault === true) {
    throw new HttpError(
      409,
      `„${arr.name}" ist das Standard-Arrangement. Mache zuerst ein anderes zum Standard, dann ` +
        'lässt es sich löschen.',
    );
  }

  await deleteArrangement(cookie, songId, arrangementId);
  return { name: arr.name };
}
