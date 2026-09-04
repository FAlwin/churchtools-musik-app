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
import { LIEDTEXT_SUCHE_MIN_ZEICHEN, type SongTextTreffer } from '@shared/types/index';
import { CtOverloadedError, isCtOverloaded } from './ctHttp.js';
import { downloadFileText } from './ctFiles.js';
import { getAllSongs } from './ctRead.js';
import { createGebuendelterLauf } from './gebuendelterLauf.js';
import { mapLimit } from './mapLimit.js';
import { isOriginalChordpro } from './arrangementFiles.js';
import type { CtSongListEntry } from './ctTypes.js';

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
  /**
   * Das **rohe ChordPro** des Original-Notenblatts (#379, seit 04.09.2026 statt eines gekürzten Anfangs).
   *
   * Getrennt von `text`, weil beide verschiedene Aufgaben haben: `text` ist zum **Suchen** gebaut
   * (kleingeschrieben, ohne Akkorde), das ChordPro für die **Vorschau** – der Client zerlegt es mit
   * demselben Parser wie das Blatt in Abschnitte (Vers, Chorus). Alwin: „Manchmal braucht man genau den
   * Chorus, um auf das Lied zu kommen." Bei ~50 Liedern sind das ein paar hundert Kilobyte – deutlich
   * billiger, als für eine Vorschau eine Datei zu laden, die schon einmal durch die Leitung ging.
   */
  chordpro: string;
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
export function chordproZuLesetext(chordpro: string): string {
  return chordpro
    .replace(/\{[^}]*\}/g, ' ') // Direktiven samt Inhalt
    .replace(/\[[^\]]*\]/g, '') // Akkorde ERSATZLOS – sonst zerfallen Wörter
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Die **Vergleichsform** – sie muss für den Index UND für den Suchbegriff dieselbe sein.
 *
 * Deshalb steht sie hier und nicht als `toLocaleLowerCase` an drei Stellen: Gesucht wird mit
 * `text.includes(gesucht)`. Würde eine der beiden Seiten anders normalisiert – etwa weil jemand später
 * Umlaute oder Bindestriche mit einbezieht –, **fände die Suche schlicht nichts mehr**, ohne Fehler und
 * ohne Hinweis. Genau diese Sorte stiller Bruch entsteht, wenn eine Regel zweimal existiert.
 */
export function zuSuchform(text: string): string {
  return text.toLocaleLowerCase('de-DE');
}

/**
 * Derselbe Text, in der Suchform – die Form, in der gesucht wird.
 *
 * Baut bewusst auf `chordproZuLesetext` auf, statt die Ersetzungen zu wiederholen: Die Regel „Akkorde
 * ersatzlos" gibt es damit **einmal**. Zwei Fassungen wären zwei Stellen, an denen die nächste Korrektur
 * landen müsste – und die zweite wird vergessen.
 */
export function chordproZuText(chordpro: string): string {
  return zuSuchform(chordproZuLesetext(chordpro));
}

/**
 * Die Datei, aus der Suchtext und Vorschau kommen: das **Original**-ChordPro des Liedes.
 *
 * **Nutzt `isOriginalChordpro` und baut die Regel nicht nach** (#379). Vorher stand hier ein eigenes
 * `!/\(App\)\.chordpro$/i` – das erkannte nur den heutigen Marker. Bestandsdateien mit den älteren
 * Kürzeln (`— <Name> (ECG).chordpro`, `— Bearbeitet.chordpro`) gingen damit als Original durch.
 *
 * **Die Folge, genau benannt:** Gesucht wird mit `.find()`, es gewinnt also die **erste** passende Datei.
 * Steht eine solche Bestandsfassung in der ChurchTools-Antwort **vor** dem Original, wurde der
 * **bearbeitete** Text indexiert statt des echten – die Suche fand dann die falsche Fassung, und die
 * Vorschau zeigte sie. (Nicht: „das Lied stand doppelt drin" – `find` liefert nur eine Datei. Diese
 * erste Diagnose war falsch und wäre unbemerkt geblieben, hätte die Gegenprobe sie nicht widerlegt.)
 */
function originalChordpro(song: CtSongListEntry): { name: string; fileUrl: string } | undefined {
  return song.arrangements?.flatMap((a) => a.files ?? []).find(isOriginalChordpro);
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
    const datei = originalChordpro(song);
    if (!datei) {
      ohneText++;
      return;
    }
    try {
      // Einmal aufbereiten, zweimal genutzt: Suchtext und Vorschau (lesbar) aus demselben Lauf.
      // Die Kleinschreibung läuft über `zuSuchform` – dieselbe Funktion, die auch den Suchbegriff
      // normalisiert. Zwei Fassungen davon würden die Suche still ins Leere laufen lassen.
      const chordpro = await downloadFileText(cookie, datei.fileUrl);
      const lesetext = chordproZuLesetext(chordpro);
      const text = zuSuchform(lesetext);
      if (text) {
        eintraege.push({
          songId: song.id,
          name: song.name,
          text,
          chordpro,
        });
      } else ohneText++;
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
  // Dieselbe Vergleichsform wie der Index – siehe `zuSuchform`.
  const gesucht = zuSuchform(begriff.trim());
  if (gesucht.length < LIEDTEXT_SUCHE_MIN_ZEICHEN) return [];

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

/**
 * Der Anfang eines Liedtexts zum Nachlesen (#379) – **auf Verlangen, für EIN Lied.**
 *
 * Anlass (Alwin, 13.08.2026): Heißen mehrere Lieder gleich und ist der Autor unbekannt, entscheidet nur
 * ein Blick in den Text. Ausgelöst wird das je Lied, nicht für die Liste.
 *
 * **Der Index wird dafür nie gebaut, nur benutzt** – das ist der ganze Trick:
 *
 *  - Steht er frisch (weil gerade in Liedtexten gesucht wurde), kostet die Vorschau **keine** Anfrage.
 *  - Steht er nicht, wird **genau dieses eine** Notenblatt geladen. Ein Index-Aufbau (~50 Downloads)
 *    nur für zwei Zeilen wäre grob unverhältnismäßig – und genau die Sorte Last, die in #300 das
 *    ChurchTools-Limit gerissen hat.
 *
 * `null` heißt „dieses Lied hat keinen Text" – die Oberfläche zeigt dann **keine** leere Vorschau.
 */
export async function liedtextVorschau(cookie: string, songId: number): Promise<string | null> {
  const vorhanden = index;
  if (vorhanden !== null && Date.now() - vorhanden.at < INDEX_TTL_MS) {
    const treffer = vorhanden.eintraege.find((e) => e.songId === songId);
    // Nur wenn das Lied im Index steht. Fehlt es dort, hat es beim Aufbau keinen Text gehabt – dann
    // lohnt der Versuch unten trotzdem, denn seitdem kann eines hinzugekommen sein.
    if (treffer) return treffer.chordpro;
  }

  const songs = await getAllSongs(cookie);
  const song = songs.find((s) => s.id === songId);
  if (!song) return null;
  const datei = originalChordpro(song);
  if (!datei) return null;

  const chordpro = await downloadFileText(cookie, datei.fileUrl);
  const lesetext = chordproZuLesetext(chordpro);
  // Nur mit Text: Eine Datei aus lauter Direktiven ist kein Liedtext – die Oberfläche sagt dann
  // „kein Liedtext“ statt eine leere Vorschau zu zeigen.
  return lesetext ? chordpro : null;
}
