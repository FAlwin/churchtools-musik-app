import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  __resetSongTextIndexForTests,
  ausschnitt,
  chordproZuLesetext,
  chordproZuText,
  liedtextVorschau,
  sucheImLiedtext,
  vorschauAus,
  zuSuchform,
} from './songTextIndex.js';

/**
 * Suche im Liedtext (#322).
 *
 * **Die wichtigste Regel steht in `chordproZuText`:** Akkorde fallen **ersatzlos** weg. „ge[Am]liebt"
 * muss bei „geliebt" gefunden werden – mit einem Leerzeichen als Ersatz entstünde „ge liebt" und der
 * Treffer bliebe aus. Genau daran scheitert eine naive Umsetzung.
 *
 * **Und die teuerste:** Der Aufbau kostet einen Datei-Download je Lied. Fünf gleichzeitige Suchen dürfen
 * EINEN Aufbau auslösen – sonst ist es wieder #300.
 */
const COOKIE = 'ChurchTools_sid=abc';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const LIEDER = [
  {
    id: 1,
    name: 'Befreit durch deine Gnade',
    arrangements: [
      {
        id: 10,
        name: 'Standard',
        key: 'E',
        keyOfArrangement: 'E',
        files: [{ name: 'Befreit.chordpro', fileUrl: 'https://test.church.tools/f/1' }],
      },
    ],
  },
  {
    id: 2,
    name: 'Treu',
    arrangements: [
      {
        id: 20,
        name: 'Standard',
        key: 'D',
        keyOfArrangement: 'D',
        /**
         * **Die App-Fassungen stehen ABSICHTLICH VOR dem Original** (#379) – und darauf kommt es an:
         *
         * Gesucht wird mit `.find()`, also gewinnt die **erste** Datei, die als Original durchgeht. Der
         * Index prüfte vorher mit einem eigenen `!/\(App\)\.chordpro$/i` und erkannte nur den heutigen
         * Marker; `— <Name> (ECG).chordpro` und `— Bearbeitet.chordpro` gingen damit als Original durch.
         * Steht so eine Bestandsdatei in der ChurchTools-Antwort **vor** dem Original, wurde die
         * **bearbeitete Fassung indexiert statt des Originals** – die Suche fand dann den falschen Text.
         *
         * Mit dem Original an erster Stelle wäre der Fehler unsichtbar: Genau daran blieb meine erste
         * Gegenprobe grün. Die Reihenfolge ist hier das Werkzeug, nicht Zufall.
         */
        files: [
          { name: 'Treu — Jugend (ECG).chordpro', fileUrl: 'https://test.church.tools/f/5' },
          { name: 'Treu — Bearbeitet.chordpro', fileUrl: 'https://test.church.tools/f/6' },
          { name: 'Treu — ECGD (App).chordpro', fileUrl: 'https://test.church.tools/f/3' },
          { name: 'Treu.chordpro', fileUrl: 'https://test.church.tools/f/2' },
        ],
      },
    ],
  },
  // Ein Lied ganz ohne ChordPro – darf den Aufbau nicht stören.
  {
    id: 3,
    name: 'Nur ein PDF',
    arrangements: [
      {
        id: 30,
        name: 'Standard',
        key: null,
        keyOfArrangement: null,
        files: [{ name: 'blatt.pdf', fileUrl: 'https://test.church.tools/f/4' }],
      },
    ],
  },
];

const TEXTE: Record<string, string> = {
  'https://test.church.tools/f/1': '{title: Befreit}\n[G]Ich bin ge[Am]liebt und frei\n',
  'https://test.church.tools/f/2': '{title: Treu}\n[D]Deine Treue trägt mich [A]jeden Tag\n',
  // Die drei App-Fassungen. Jede trägt ein eigenes Wort: So zeigt ein Treffer darauf, WELCHER Marker
  // durchgerutscht ist – ein gemeinsames Wort hätte nur „irgendeine" verraten.
  'https://test.church.tools/f/3': '{title: Treu}\n[D]Appfassung nicht indexieren\n',
  'https://test.church.tools/f/5': '{title: Treu}\n[D]Ecgfassung nicht indexieren\n',
  'https://test.church.tools/f/6': '{title: Treu}\n[D]Bearbeitetfassung nicht indexieren\n',
};

/** Zählt die Downloads – daran hängt die Aussage „ein Aufbau, nicht fünf". */
let downloads = 0;

/**
 * **Die Datei-URLs müssen zur Test-Instanz gehören.** Im ersten Entwurf standen hier
 * `https://ct.example/…` – `downloadFileText` weist fremde Hosts ab (`assertCtFileUrl`, #199), der
 * Index verbuchte das als „Lied ohne Text", und alle Treffer-Tests waren leer. Die Prüfung ist richtig;
 * der Testaufbau war falsch. Genau deshalb steht die Download-Zählung unten im Test: Sie zeigt
 * sofort, dass gar nichts geladen wurde.
 */
function mockCt(opts: { drosselAb?: number } = {}): void {
  downloads = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
    const u = String(url);
    if (u.includes('/api/songs')) return Promise.resolve(json({ data: LIEDER }));
    if (u.startsWith('https://test.church.tools/f/')) {
      downloads++;
      if (opts.drosselAb !== undefined && downloads > opts.drosselAb) {
        return Promise.resolve(new Response('', { status: 429 }));
      }
      return Promise.resolve(new Response(TEXTE[u] ?? '', { status: TEXTE[u] ? 200 : 404 }));
    }
    throw new Error(`unerwarteter Aufruf: ${u}`);
  });
}

beforeEach(() => __resetSongTextIndexForTests());
afterEach(() => vi.restoreAllMocks());

describe('chordproZuText – die Regel, an der eine naive Suche scheitert', () => {
  it('entfernt Akkorde ERSATZLOS, damit Wörter nicht zerfallen', () => {
    expect(chordproZuText('[G]Ich bin ge[Am]liebt')).toContain('geliebt');
    expect(chordproZuText('[G]Ich bin ge[Am]liebt')).not.toContain('ge liebt');
  });

  it('wirft Direktiven samt Inhalt weg', () => {
    const text = chordproZuText('{title: Treu}\n{comment: 2x spielen}\nDeine Treue');
    expect(text).toBe('deine treue');
  });

  it('schreibt klein und drückt Leerraum zusammen', () => {
    expect(chordproZuText('DEINE   Treue\n\n  trägt')).toBe('deine treue trägt');
  });
});

describe('ausschnitt – warum wurde das Lied gefunden?', () => {
  it('zeigt die Fundstelle mit Umgebung', () => {
    const text = 'a'.repeat(200) + 'geliebt' + 'b'.repeat(200);
    const a = ausschnitt(text, 'geliebt');
    expect(a).toContain('geliebt');
    expect(a.startsWith('… ')).toBe(true);
    expect(a.endsWith(' …')).toBe(true);
  });

  it('kommt ohne Auslassungszeichen aus, wenn der Text kurz ist', () => {
    expect(ausschnitt('deine treue trägt', 'treue')).toBe('deine treue trägt');
  });

  it('liefert leer, wenn der Begriff nicht vorkommt', () => {
    expect(ausschnitt('deine treue', 'gnade')).toBe('');
  });
});

describe('sucheImLiedtext', () => {
  it('findet ein Wort, das nur im TEXT steht – nicht im Titel', async () => {
    // Genau der Fall, für den es das Ganze gibt: „geliebt" steht in keinem Liednamen.
    mockCt();
    const treffer = await sucheImLiedtext(COOKIE, 'geliebt');
    expect(treffer).toHaveLength(1);
    expect(treffer[0].name).toBe('Befreit durch deine Gnade');
    expect(treffer[0].ausschnitt).toContain('geliebt');
  });

  it('nimmt das ORIGINAL, auch wenn App-Fassungen davor stehen (#379)', async () => {
    /**
     * **Der Fehler war echt, aber anders als zuerst gedacht** (14.08.2026): Der Index prüfte mit einem
     * eigenen `!/\(App\)\.chordpro$/i` statt mit `isOriginalChordpro` und kannte damit nur den heutigen
     * Marker. Weil `.find()` die **erste** passende Datei nimmt, wurde eine Bestandsfassung
     * (`(ECG)`, `— Bearbeitet`) indexiert, sobald sie vor dem Original stand – die Suche fand dann den
     * **bearbeiteten** Text und nicht den echten.
     *
     * Nicht „das Lied stand doppelt drin": `find` liefert genau eine Datei. Meine erste Fassung dieses
     * Tests behauptete das und blieb ohne den Fix grün – die Gegenprobe hat die Diagnose korrigiert.
     */
    mockCt();
    for (const wort of ['appfassung', 'ecgfassung', 'bearbeitetfassung']) {
      expect(await sucheImLiedtext(COOKIE, wort)).toEqual([]);
    }
    const treu = await sucheImLiedtext(COOKIE, 'treue trägt');
    expect(treu).toHaveLength(1);
  });

  it('baut den Index nur EINMAL – auch bei fünf gleichzeitigen Suchen', async () => {
    /**
     * Die teuerste Zusicherung: Der Aufbau kostet einen Download je Lied. Fünf iPads, die gleichzeitig
     * suchen, dürfen nicht fünf Läufe starten – das war der Mechanismus hinter #300.
     */
    mockCt();
    await Promise.all([
      sucheImLiedtext(COOKIE, 'geliebt'),
      sucheImLiedtext(COOKIE, 'treue'),
      sucheImLiedtext(COOKIE, 'frei'),
      sucheImLiedtext(COOKIE, 'jeden'),
      sucheImLiedtext(COOKIE, 'tag'),
    ]);
    // Zwei ChordPro-Dateien (die App-Fassung wird übersprungen, das PDF-Lied hat keine).
    expect(downloads).toBe(2);
  });

  it('sucht beim zweiten Mal aus dem Index, ohne erneut zu laden', async () => {
    mockCt();
    await sucheImLiedtext(COOKIE, 'geliebt');
    const nachErsterSuche = downloads;
    await sucheImLiedtext(COOKIE, 'treue');
    expect(downloads).toBe(nachErsterSuche);
  });

  it('sucht unter drei Zeichen gar nicht', async () => {
    mockCt();
    expect(await sucheImLiedtext(COOKIE, 'ge')).toEqual([]);
    expect(downloads).toBe(0);
  });

  it('ignoriert Groß-/Kleinschreibung', async () => {
    mockCt();
    expect(await sucheImLiedtext(COOKIE, 'GELIEBT')).toHaveLength(1);
  });

  it('ein Lied ohne ChordPro stört den Aufbau nicht', async () => {
    mockCt();
    const alle = await sucheImLiedtext(COOKIE, 'e');
    expect(alle).toEqual([]); // zu kurz – aber der Aufbau lief für die anderen Tests schon
    expect(await sucheImLiedtext(COOKIE, 'treue')).toHaveLength(1);
  });

  it('meldet eine Drosselung, statt eine halbe Trefferliste auszugeben', async () => {
    /**
     * Ein halber Index wäre schlimmer als keiner: Er sähe wie ein vollständiges Ergebnis aus und würde
     * eine Stunde lang Lieder verschweigen. „Nichts gefunden" und „konnte nicht suchen" sind zwei
     * verschiedene Aussagen (#270).
     */
    mockCt({ drosselAb: 0 });
    await expect(sucheImLiedtext(COOKIE, 'geliebt')).rejects.toThrow(/bremst uns/);
  });
});

describe('chordproZuLesetext – dieselbe Aufbereitung, aber LESBAR (#379)', () => {
  it('behält Groß-/Kleinschreibung', () => {
    expect(chordproZuLesetext('[G]Ich bin ge[Am]liebt')).toBe('Ich bin geliebt');
  });

  it('entfernt Akkorde trotzdem ersatzlos – die Regel gibt es nur einmal', () => {
    // `chordproZuText` baut auf dieser Funktion auf; ein Bruch hier bräche auch die Suche.
    expect(chordproZuLesetext('ge[Am]liebt')).toBe('geliebt');
    expect(chordproZuText('ge[Am]liebt')).toBe('geliebt');
  });
});

describe('vorschauAus – der Textanfang für die Auswahl (#379)', () => {
  it('kurze Texte stehen ganz da, OHNE Auslassungszeichen', () => {
    // Es soll nur behaupten, dass mehr kommt, wenn wirklich mehr kommt.
    expect(vorschauAus('Deine Treue trägt mich', 220)).toBe('Deine Treue trägt mich');
  });

  it('schneidet an der Wortgrenze ab, nicht mitten im Wort', () => {
    const lang = 'Deine Treue trägt mich jeden einzelnen Tag durch alles hindurch';
    const kurz = vorschauAus(lang, 20);
    expect(kurz.endsWith(' …')).toBe(true);
    // Kein halbes Wort vor dem Auslassungszeichen.
    expect(lang.startsWith(kurz.replace(' …', ''))).toBe(true);
    expect(kurz.replace(' …', '').split(' ').pop()).not.toBe('trä');
  });

  it('bei einem einzigen überlangen Wort wird hart geschnitten, statt leer zu bleiben', () => {
    const kurz = vorschauAus('x'.repeat(50), 20);
    expect(kurz.length).toBeGreaterThan(10);
  });
});

describe('liedtextVorschau – auf Verlangen, für EIN Lied (#379)', () => {
  it('nimmt den Text aus dem Index, wenn der frisch dasteht – OHNE neuen Download', async () => {
    mockCt();
    // Erst suchen (baut den Index: zwei Downloads), dann die Vorschau holen.
    await sucheImLiedtext(COOKIE, 'geliebt');
    const nachSuche = downloads;

    const v = await liedtextVorschau(COOKIE, 1);
    expect(v).toBe('Ich bin geliebt und frei');
    expect(downloads).toBe(nachSuche);
  });

  it('baut den Index NICHT, wenn er fehlt – sondern lädt genau ein Notenblatt', async () => {
    /**
     * Die teuerste Zusicherung: Ein Index-Aufbau kostet einen Download je Lied (~50 bei der ECG). Für
     * eine Vorschau von zwei Zeilen wäre das grob unverhältnismäßig – und genau die Sorte Last, die in
     * #300 das ChurchTools-Limit gerissen hat.
     */
    mockCt();
    const v = await liedtextVorschau(COOKIE, 2);

    expect(v).toBe('Deine Treue trägt mich jeden Tag');
    expect(downloads).toBe(1); // nur das eine Lied, nicht alle
  });

  it('liefert `null` für ein Lied ohne ChordPro – kein Fehler', async () => {
    // Die Oberfläche zeigt dann gar keine Vorschau statt einer leeren.
    mockCt();
    expect(await liedtextVorschau(COOKIE, 3)).toBeNull();
    expect(downloads).toBe(0);
  });

  it('liefert `null` für eine unbekannte Lied-ID', async () => {
    mockCt();
    expect(await liedtextVorschau(COOKIE, 999)).toBeNull();
  });

  it('nimmt auch hier die ORIGINAL-Datei, nicht eine App-Fassung', async () => {
    // Dieselbe Regel wie beim Index – über `isOriginalChordpro`, nicht nachgebaut.
    mockCt();
    const v = await liedtextVorschau(COOKIE, 2);
    expect(v).not.toContain('nicht indexieren');
  });
});

/**
 * `zuSuchform` – die Form, in der Index und Suchbegriff verglichen werden (#379).
 *
 * Gesucht wird mit `text.includes(gesucht)`. Laufen die beiden Seiten auseinander, findet die Suche
 * **nichts mehr** – ohne Fehler und ohne Hinweis.
 *
 * **Ehrlich zum Umfang dieser Tests:** Ein Auseinanderlaufen im Index-Aufbau fangen sie **heute nicht** ab –
 * `toLowerCase()` und `toLocaleLowerCase('de-DE')` liefern für deutsche Texte dasselbe, ein Austausch bliebe
 * also unbeobachtbar. Genau das hat die Gegenprobe gezeigt. Der Wert der einen Funktion ist deshalb
 * **struktureller Art**: Wird die Form später erweitert (Umlaute zusammenziehen, Bindestriche entfernen),
 * treffen die Änderungen beide Seiten automatisch. Prüfbar ist die **Verkettung** – und die steht unten.
 */
describe('zuSuchform – eine Form für Index und Suchbegriff (#379)', () => {
  it('`chordproZuText` bezieht die Form über `zuSuchform`, statt sie nachzubauen', () => {
    // DAS ist die beobachtbare Zusicherung: Wer die Form in `chordproZuText` nachbaut, fällt hier durch.
    const text = 'Deine TREUE trägt';
    expect(chordproZuText(text)).toBe(zuSuchform(text));
  });

  it('der aufbereitete Liedtext enthält den normalisierten Begriff – so sucht `sucheImLiedtext`', () => {
    expect(chordproZuText('[G]Große FREUDE')).toContain(zuSuchform('Große Freude'));
    expect(chordproZuText('{c: x}\n[Am]Deine TREUE trägt')).toContain(zuSuchform('Treue Trägt'));
  });
});
