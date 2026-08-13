/**
 * Die Lied-Kategorien – und **welche davon der Nutzer bearbeiten darf** (#322, Schritt 7).
 *
 * Zwei Dinge kommen hier zusammen, und beide sind gemessen, nicht angenommen
 * (`server/scripts/probe-songmgmt.ts`, 13.08.2026, ChurchTools 3.135.2):
 *
 *  1. **Die Namen.** Unter `/api/` gibt es sie nicht – fünf Pfade geprüft, alle 404. Die alte
 *     churchservice-Schnittstelle liefert sie über `getMasterData` → `songcategory`. Dort ist `id`
 *     eine **Zeichenkette** und das Namensfeld heißt `bezeichnung`.
 *  2. **Die Rechte.** `edit songcategory` nennt die erlaubten Kategorie-IDs (bei Alwin `[0,1]`).
 *     Ausgewertet wird das an genau einer Stelle: `parseSongEditRight` in `ctCapabilities`.
 *
 * **Warum die Liste immer zugeschnitten herausgeht:** Eine Auswahl, die Kategorien anbietet, die
 * ChurchTools danach ablehnt, ist ein Knopf ins Leere. Der Schnitt passiert hier im Server und nicht
 * in der Oberfläche – dieselbe Funktion, die die Auswahl füllt, prüft später auch beim Anlegen, ob
 * eine Kategorie erlaubt war (#322, Schritt 10). Eine Prüfung, die nur in der Oberfläche steht, ist
 * keine Prüfung.
 */
import { ctAjax } from './ctAjax.js';
import { parseCapabilities, parseSongEditRight } from './ctCapabilities.js';
import { ctGet } from './ctHttp.js';
import { getAllSongs } from './ctRead.js';
import { ctId } from '../utils/ctId.js';
import type { SongCategory } from '@shared/types/index';

/** Meldungen für die alte Schnittstelle – Kategorien, nicht SongSelect (siehe `AjaxMeldungen`). */
const KAT_MELDUNGEN = {
  verweigert: 'Keine Berechtigung, die Lied-Kategorien in ChurchTools zu lesen.',
  abgelehnt: 'ChurchTools hat die Anfrage nach den Lied-Kategorien abgelehnt',
  unlesbar: 'ChurchTools lieferte keine lesbare Antwort für die Lied-Kategorien.',
  fehlgeschlagen: 'Die Lied-Kategorien konnten nicht geladen werden.',
  innenUnlesbar: 'Die Kategorie-Liste von ChurchTools war nicht lesbar.',
};

/** So liefert die alte Schnittstelle eine Kategorie: alles als Zeichenkette, Name als `bezeichnung`. */
interface RohKategorie {
  id?: string | number;
  bezeichnung?: string;
  sortkey?: string | number;
}

/**
 * Alle Kategorien der Instanz mit Namen – über `getMasterData`.
 *
 * Wirft, wenn die alte Schnittstelle nicht mitspielt. Der Aufrufer entscheidet, ob er das dem Nutzer
 * meldet oder auf die Lieder ausweicht (siehe `getSongCategories`).
 */
async function ladeKategorienMitNamen(cookie: string): Promise<SongCategory[]> {
  const daten = (await ctAjax(cookie, 'getMasterData', {}, KAT_MELDUNGEN)) as {
    songcategory?: RohKategorie[];
  };
  const roh = daten.songcategory ?? [];
  return roh
    .map((k) => ({
      // Über `ctId`: Die ID kommt als `"0"` und MUSS eine Zahl werden – sie wird später mit den IDs
      // aus dem Rechte-Array und mit `song.category.id` verglichen. `Number(k.id)` allein wäre hier
      // falsch, weil ein fehlendes Feld (`null`) dabei zur echten Kategorie 0 würde.
      id: ctId(k.id),
      name: (k.bezeichnung ?? '').trim(),
      sortkey: Number(k.sortkey ?? 0),
    }))
    .filter((k): k is { id: number; name: string; sortkey: number } => k.id !== null && !!k.name)
    .sort((a, b) => a.sortkey - b.sortkey || a.name.localeCompare(b.name, 'de'))
    .map(({ id, name }) => ({ id, name }));
}

/**
 * Rückfall: die Kategorien aus den vorhandenen Liedern zusammentragen.
 *
 * **Zeigt nur, was benutzt wird** – und genau darin liegt seine Schwäche: Bei der ECG stecken alle 49
 * Lieder in Kategorie 0, die zweite erlaubte („Inaktive Songs") käme hier gar nicht vor. Deshalb ist
 * das der Rückfall und nicht der Hauptweg. Er trägt, wenn ChurchTools die alte Schnittstelle ändert.
 */
async function ladeKategorienAusLiedern(cookie: string): Promise<SongCategory[]> {
  const songs = await getAllSongs(cookie);
  const gefunden = new Map<number, string>();
  for (const s of songs) {
    // Auch hier über `ctId` – die DRITTE Stelle mit derselben Grammatik. In `/api/songs` ist die ID
    // gemessen eine Zahl, aber eine eigene Prüfung daneben wäre wieder eine Regel in zwei Fassungen.
    const id = ctId(s.category?.id);
    if (id === null) continue;
    const name = (s.category?.name ?? '').trim();
    if (!gefunden.has(id) && name) gefunden.set(id, name);
  }
  return [...gefunden]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/**
 * Alle Kategorien der Instanz – Namen aus `getMasterData`, sonst aus den Liedern.
 *
 * Der Rückfall ist bewusst still (nur eine Warnung im Log): Die Kategorien sind Beiwerk zu einem
 * Formular, und ein Fehler der alten Schnittstelle soll das Anlegen nicht verhindern, solange sich
 * die Namen anders beschaffen lassen. Wer eine ID kennt, aber keinen Namen, bekommt später
 * „Kategorie N" angezeigt – eine Zahl ist unschön, ein leerer Eintrag wäre schlimmer.
 */
export async function getSongCategories(cookie: string): Promise<SongCategory[]> {
  try {
    const mitNamen = await ladeKategorienMitNamen(cookie);
    if (mitNamen.length > 0) return mitNamen;
    console.warn(
      '[songcategories] getMasterData lieferte keine Kategorien – weiche auf Lieder aus',
    );
  } catch (err) {
    console.warn(
      `[songcategories] getMasterData fehlgeschlagen (${err instanceof Error ? err.message : String(err)}) – weiche auf Lieder aus`,
    );
  }
  return ladeKategorienAusLiedern(cookie);
}

/**
 * Die Kategorien, in denen dieser Nutzer Lieder anlegen/ändern darf.
 *
 * **Der Schnitt mit dem Recht ist der Zweck dieser Funktion.** Ein Admin bekommt alle (das Admin-Recht
 * deckt die Kategorie-Rechte ab, so hält es `parseCapabilities` schon für `canEditSongs`); ohne
 * Aufzählung im Recht (`ids === null`) wird ebenfalls nicht eingegrenzt, weil „keine Liste genannt"
 * nicht „nichts erlaubt" heißt.
 *
 * Umgekehrt kann eine erlaubte ID **ohne Namen** dastehen – dann wird sie als „Kategorie N"
 * aufgeführt statt weggelassen. Weglassen wäre der stille Weg: Der Nutzer hätte ein Recht, das die
 * App ihm ohne ein Wort verschweigt.
 */
export async function getEditableSongCategories(cookie: string): Promise<SongCategory[]> {
  /**
   * **Die Rechte werden hier FRISCH geholt, nicht aus dem Memo.** Das ist eine Anfrage mehr, und sie
   * ist bewusst: Es geht um eine Schreibberechtigung, und in diesem Projekt haben zwischengespeicherte
   * Rechte schon zweimal zu Funden geführt (#249, #282 – „was fremde Daten freigibt, wird nie
   * überbrückt"). Dazu kommt der Aufruf nur beim Öffnen des Formulars und beim Anlegen vor – eine
   * Handlung eines Menschen, keine Dauerlast im Minutentakt wie die Terminliste (#306).
   */
  const rechte = await ctGet<Record<string, Record<string, unknown>>>(
    cookie,
    '/api/permissions/global',
  );
  /**
   * **Der Admin-Fall muss hier stehen, sonst widerspricht sich die App.**
   *
   * `parseSongEditRight` kennt nur `edit songcategory` – ein Administrator OHNE dieses Recht hat dort
   * `ids: []`. `canEditSongs` ist bei ihm aber `true` (das Admin-Recht deckt es ab, siehe
   * `parseCapabilities`). Ohne diese Zeile bekäme er also den Knopf „Neues Lied" und dahinter eine
   * **leere** Kategorie-Auswahl. Bei der ECG ist `[0,1]` gesetzt, das wäre nie aufgefallen – bei einer
   * anderen Gemeinde, die dieses Repo betreibt, schon. Wieder „die Regel gilt für A, B, C – C fehlt".
   *
   * `parseCapabilities` liest dieselbe Antwort; ein zweiter Abruf entsteht dadurch nicht. Dass es bei
   * einer leeren Antwort wirft, ist gewollt: Dann ist die Lage unklar, und „bitte erneut versuchen"
   * ist richtiger als eine geratene Liste (#149).
   */
  const { isAdmin } = parseCapabilities(rechte);
  const recht = parseSongEditRight(rechte);
  const alle = await getSongCategories(cookie);

  // Ohne Einschränkung (Admin oder Recht ohne Aufzählung): alles, was die Instanz kennt.
  if (isAdmin || recht.ids === null) return alle;

  const bekannt = new Map(alle.map((k) => [k.id, k.name]));
  return recht.ids.map((id) => ({ id, name: bekannt.get(id) ?? `Kategorie ${id}` }));
}
