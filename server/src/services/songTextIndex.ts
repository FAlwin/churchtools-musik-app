/**
 * **Suche im Liedtext** (#322, Wunsch Alwin: „wenn man nicht genau den Titel kennt").
 *
 * **Warum das ein Index sein muss – gemessen, nicht vermutet (13.08.2026, `probe-songsuche.ts`):**
 *
 *  - **ChurchTools kann es nicht.** `/api/songs?query=…` filtert nur Stammdaten: Ein Wort aus dem
 *    Liedtext ergab **0** Treffer, dasselbe Wort aus dem Titel **1** (Gegenprobe). Die Liedtexte liegen
 *    dort als **Datei** am Arrangement, nicht als Feld.
 *  - **CCLI kann es auch nicht** – acht naheliegende Funktionsnamen für eine Textsuche existieren nicht
 *    (`getCCLILyrics` gibt es, holt aber nur den Text zu EINER Nummer).
 *
 * Bleibt: **wir suchen selbst.** Dafür wird jeder Liedtext einmal geladen und im Speicher gehalten.
 *
 * **Der teure Teil ist der Aufbau: ein Datei-Download je Lied** (~50 bei der ECG). Genau diese Sorte
 * Lauf hat in #300 das ChurchTools-Limit gerissen, deshalb drei Vorkehrungen – dieselben wie bei der
 * Song-Statistik, aus demselben Baustein:
 *
 *  1. **gebündelt** – fünf iPads, die gleichzeitig suchen, lösen EINEN Aufbau aus,
 *  2. **gedrosselt** – höchstens 6 Downloads gleichzeitig, und bei einer Drosselung sofort Schluss,
 *  3. **gecacht** – eine Stunde; danach wird beim nächsten Suchen neu gebaut.
 *
 * **Der Index hält nur, was zum Suchen nötig ist:** kleingeschriebenen Text ohne Akkorde und ohne
 * ChordPro-Direktiven. Er ist bewusst org-weit und kontenunabhängig – wie die Statistik: Liedtexte sind
 * für alle dieselben, und der Bestand ist ohnehin für jeden mit Lieder-Recht sichtbar.
 */
import type { SongTextTreffer } from '@shared/types/index';
import { CtOverloadedError, isCtOverloaded } from './ctHttp.js';
import { downloadFileText } from './ctFiles.js';
import { getAllSongs } from './ctRead.js';
import { createGebuendelterLauf } from './gebuendelterLauf.js';
import { mapLimit } from './mapLimit.js';

/** Wie lange ein aufgebauter Index gilt. Liedtexte ändern sich selten; eine Stunde ist reichlich. */
const INDEX_TTL_MS = 3_600_000;
/** Sperrfrist nach einer Drosselung – wie bei der Statistik. */
const INDEX_COOLDOWN_MS = 120_000;
/** Gleichzeitige Datei-Downloads. Bewusst niedriger als die 8 der Statistik: Dateien sind schwerer. */
const PARALLEL = 6;

interface IndexEintrag {
  songId: number;
  name: string;
  /** Kleingeschrieben, ohne Akkorde und Direktiven – nur zum Suchen. */
  text: string;
}

let index: { at: number; eintraege: IndexEintrag[] } | null = null;
const indexLauf = createGebuendelterLauf<IndexEintrag[]>(INDEX_COOLDOWN_MS);

/** Nur für Tests: Index, laufenden Aufbau und Sperrfrist zurücksetzen. */
export function __resetSongTextIndexForTests(): void {
  index = null;
  indexLauf.reset();
}

/**
 * ChordPro auf reinen Text reduzieren – **das ist die Regel, auf die es bei der Suche ankommt.**
 *
 * `[Am]` mitten in einem Wort ist der Grund: „ge[Am]liebt" muss bei der Suche nach „geliebt" gefunden
 * werden. Würde man Akkorde nur durch Leerzeichen ersetzen, entstünde „ge liebt" – und der Treffer
 * bliebe aus. Deshalb fallen sie **ersatzlos** weg.
 *
 * Direktiven (`{title: …}`, `{comment: …}`) fliegen ganz heraus: Der Titel wird ohnehin schon in der
 * Liste durchsucht, und Kommentare wie „2× spielen" sind kein Liedtext.
 */
export function chordproZuText(chordpro: string): string {
  return chordpro
    .replace(/\{[^}]*\}/g, ' ') // Direktiven samt Inhalt
    .replace(/\[[^\]]*\]/g, '') // Akkorde ERSATZLOS – sonst zerfallen Wörter
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('de-DE');
}

/**
 * Einen Textausschnitt um den Treffer bauen – damit man **sieht**, warum ein Lied gefunden wurde.
 *
 * Ohne ihn müsste man jedes Lied öffnen, um zu prüfen, ob es das gesuchte ist. Der Ausschnitt kommt aus
 * dem bereits kleingeschriebenen Suchtext; das ist ehrlich („so wurde gesucht") und spart, den
 * Originaltext zusätzlich im Speicher zu halten.
 */
export function ausschnitt(text: string, treffer: string, laenge = 90): string {
  const pos = text.indexOf(treffer);
  if (pos < 0) return '';
  const von = Math.max(0, pos - Math.floor((laenge - treffer.length) / 2));
  const bis = Math.min(text.length, von + laenge);
  return (von > 0 ? '… ' : '') + text.slice(von, bis).trim() + (bis < text.length ? ' …' : '');
}

/** Baut den Index: für jedes Lied das Original-ChordPro laden und auf Suchtext reduzieren. */
async function baueIndex(cookie: string): Promise<IndexEintrag[]> {
  const started = Date.now();
  const songs = await getAllSongs(cookie);
  const eintraege: IndexEintrag[] = [];
  let gedrosselt = false;
  let ohneText = 0;

  await mapLimit(songs, PARALLEL, async (song) => {
    // Notbremse: Sobald ChurchTools gebremst hat, keine weiteren Downloads mehr starten (#300).
    if (gedrosselt) return;
    const datei = song.arrangements
      ?.flatMap((a) => a.files ?? [])
      .find((f) => /\.chordpro$/i.test(f.name) && !/\(App\)\.chordpro$/i.test(f.name));
    if (!datei) {
      ohneText++;
      return;
    }
    try {
      const text = chordproZuText(await downloadFileText(cookie, datei.fileUrl));
      if (text) eintraege.push({ songId: song.id, name: song.name, text });
      else ohneText++;
    } catch (e) {
      if (isCtOverloaded(e)) {
        gedrosselt = true;
        return;
      }
      // Ein einzelnes nicht ladbares Notenblatt darf den Index nicht verhindern – das Lied fehlt dann
      // nur in der Textsuche und bleibt über den Titel weiter findbar.
      ohneText++;
    }
  });

  if (gedrosselt) {
    indexLauf.sperren();
    console.warn(
      `[songTextIndex] Aufbau ABGEBROCHEN (ChurchTools drosselt) nach ` +
        `${((Date.now() - started) / 1000).toFixed(1)} s; Sperrfrist ` +
        `${Math.round(INDEX_COOLDOWN_MS / 1000)} s`,
    );
    // Ein halber Index wäre schlimmer als keiner: Er würde eine Stunde lang Lieder verschweigen und
    // dabei aussehen wie ein vollständiges Ergebnis.
    if (index) return index.eintraege;
    throw new CtOverloadedError(INDEX_COOLDOWN_MS);
  }

  index = { at: Date.now(), eintraege };
  indexLauf.entsperren();
  console.warn(
    `[songTextIndex] Aufbau beendet: ${eintraege.length} Lieder mit Text, ${ohneText} ohne, ` +
      `${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
  return eintraege;
}

/**
 * Sucht `begriff` in den Liedtexten (#322).
 *
 * Beim ersten Aufruf (und nach einer Stunde) wird der Index gebaut – das dauert, und **die Oberfläche
 * sagt das**, statt so zu tun, als wäre Suchen immer gleich schnell.
 */
export async function sucheImLiedtext(cookie: string, begriff: string): Promise<SongTextTreffer[]> {
  const gesucht = begriff.trim().toLocaleLowerCase('de-DE');
  if (gesucht.length < 3) return [];

  const vorhanden = index;
  const frisch = vorhanden !== null && Date.now() - vorhanden.at < INDEX_TTL_MS;
  if (!frisch && indexLauf.istGesperrt()) {
    /**
     * Während einer Drosselung wird **nicht** neu gebaut. Liegt ein älterer Index vor, ist der die
     * bessere Antwort als ein Fehler – Liedtexte ändern sich selten. Liegt keiner vor, muss die
     * Oberfläche erfahren, dass sie kurz warten soll, statt eine leere Trefferliste zu sehen: „nichts
     * gefunden" und „konnte nicht suchen" sind zwei verschiedene Aussagen (#270).
     */
    if (vorhanden === null) throw new CtOverloadedError(indexLauf.restMs());
  }
  const eintraege =
    frisch && vorhanden !== null
      ? vorhanden.eintraege
      : await indexLauf.fuehreAus(() => baueIndex(cookie));

  return eintraege
    .filter((e) => e.text.includes(gesucht))
    .map((e) => ({ songId: e.songId, name: e.name, ausschnitt: ausschnitt(e.text, gesucht) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));
}
