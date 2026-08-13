import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  __resetSongTextIndexForTests,
  ausschnitt,
  chordproZuText,
  sucheImLiedtext,
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
        files: [
          { name: 'Treu.chordpro', fileUrl: 'https://test.church.tools/f/2' },
          // Die von der App gepflegte Fassung wird NICHT indexiert – sonst stünde dasselbe Lied
          // zweimal im Index und ein Treffer wäre doppelt.
          { name: 'Treu — ECGD (App).chordpro', fileUrl: 'https://test.church.tools/f/3' },
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
  'https://test.church.tools/f/3': '{title: Treu}\n[D]Sollte nicht indexiert werden\n',
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

  it('indexiert die App-Fassung NICHT – sonst stünde ein Lied doppelt drin', async () => {
    mockCt();
    expect(await sucheImLiedtext(COOKIE, 'indexiert')).toEqual([]);
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
