import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { leeren, tempVerzeichnis } from '../testHilfen/tempAblage.js';

// Temporären Ablageort setzen, BEVOR das Modul (und damit config.ts) importiert wird.
const dir = tempVerzeichnis('annotations-test');
process.env.ANNOTATIONS_PATH = dir;

type Mod = typeof import('./annotations.js');
let mod: Mod;

beforeAll(async () => {
  mod = await import('./annotations.js');
});

beforeEach(async () => {
  await leeren(dir);
});

const USER = 4711;

describe('withinAccountLimits (#139 – reine Grenzlogik)', () => {
  it('akzeptiert Werte an der Grenze, lehnt darüber ab', () => {
    expect(mod.withinAccountLimits(mod.MAX_ENTRIES_PER_ACCOUNT, 0)).toBe(true);
    expect(mod.withinAccountLimits(mod.MAX_ENTRIES_PER_ACCOUNT + 1, 0)).toBe(false);
    expect(mod.withinAccountLimits(0, mod.MAX_BYTES_PER_ACCOUNT)).toBe(true);
    expect(mod.withinAccountLimits(0, mod.MAX_BYTES_PER_ACCOUNT + 1)).toBe(false);
  });
});

/**
 * **Diese beiden Tests brauchen mehr Zeit als die Standard-Grenze von 5 Sekunden** – und zwar nicht,
 * weil etwas hängt, sondern weil sie eine **50-MB-Grenze** wirklich erreichen müssen. Jeder
 * Schreibvorgang legt die ganze Kontodatei neu an, die dabei mitwächst: in Summe rund 275 MB.
 *
 * Gemessen am 20.09.2026: lokal 0,7 s und 1,2 s – im CI-Lauf 35531036193 (PR #397) reißen sie die
 * 5 Sekunden. Derselbe Commit lief im Push-Workflow desselben Zeitpunkts grün durch; es lag also
 * nicht am geprüften Code, sondern an der langsameren Maschine.
 *
 * **Die Zeitgrenze hochzusetzen ist hier die ehrliche Lösung, nicht das Zudecken eines Problems:**
 * Ein Test, der absichtlich 275 MB schreibt, ist langsam. 30 Sekunden lassen das Fünfundzwanzigfache
 * der lokalen Zeit zu und würden einen echten Hänger trotzdem beenden.
 *
 * **Warum das auch den NÄCHSTEN Test rettete:** Lief einer von beiden in die Zeitgrenze, schrieb
 * seine Schleife weiter, während der folgende Test das Verzeichnis schon leerte – und dessen
 * Aufräumen scheiterte dann mit `ENOTEMPTY`. Genau so stand es im CI-Protokoll. Dagegen hilft
 * zusätzlich das `leeren` aus `testHilfen/tempAblage.ts`, das Wiederholungen mitbringt.
 */
const GRENZWERT_TIMEOUT_MS = 30_000;

describe('putAnnotation – Konto-Obergrenze (#139)', () => {
  const key = (n: number) => `song${n}_vorig_1`;

  it('normale Anmerkung wird gespeichert und ist wieder lesbar', async () => {
    await mod.putAnnotation(USER, key(1), {
      texts: [],
      strokes: 'data:image/png;base64,AAAA',
      zoom: null,
    });
    const stored = await mod.getAnnotations(USER, [1]);
    expect(stored[key(1)]?.strokes).toBe('data:image/png;base64,AAAA');
  });

  it(
    'wirft 413, wenn ein neuer Eintrag die Gesamtgröße über die Grenze treibt',
    async () => {
      // Ein fast grenzgroßer strokes-Wert (unter dem 6-MB-Einzellimit des Controllers, aber in Summe
      // über MAX_BYTES_PER_ACCOUNT, wenn genug Seiten belegt sind).
      const big = 'x'.repeat(5_000_000);
      let thrown: unknown = null;
      // So viele Einträge anlegen, bis die Grenze greift (jeweils eigener Key).
      for (let i = 0; i < 20 && !thrown; i++) {
        try {
          await mod.putAnnotation(USER, key(i), { strokes: big });
        } catch (e) {
          thrown = e;
        }
      }
      expect(thrown).toBeTruthy();
      expect((thrown as { status?: number }).status).toBe(413);
    },
    GRENZWERT_TIMEOUT_MS,
  );

  it(
    'Löschen (leerer Eintrag) bleibt möglich, auch wenn das Konto voll ist',
    async () => {
      const big = 'x'.repeat(5_000_000);
      for (let i = 0; i < 20; i++) {
        try {
          await mod.putAnnotation(USER, key(i), { strokes: big });
        } catch {
          break; // Grenze erreicht
        }
      }
      // Einen vorhandenen Eintrag leeren → muss ohne Wurf durchgehen (Freiräumen ist immer erlaubt).
      await expect(
        mod.putAnnotation(USER, key(0), { strokes: null, texts: [], zoom: null }),
      ).resolves.toBeUndefined();
      const stored = await mod.getAnnotations(USER, [0]);
      expect(stored[key(0)]).toBeUndefined();
    },
    GRENZWERT_TIMEOUT_MS,
  );
});

/**
 * #273: Ein Lesefehler darf die Kontodatei NICHT vernichten.
 *
 * Vorher fing `read()` jeden Fehler und legte `{}` als Wahrheit in den Cache. Der nächste
 * `putAnnotation` schrieb diesen leeren Stand samt dem einen neuen Eintrag zurück – **alle übrigen
 * Anmerkungen des Kontos waren weg**, ohne Meldung. Nur `ENOENT` darf „leer" heißen.
 *
 * Die Fehler entstehen hier ohne `chmod`: Ein **Verzeichnis** an der Stelle der Datei liefert
 * verlässlich `EISDIR`, und beschädigtes JSON ist ohnehin ein reiner Inhaltsfall. `chmod 000` würde
 * als root nicht greifen – der Test wäre dann still wirkungslos.
 *
 * Jedes `it` nutzt ein EIGENES Konto: Der Cache ist je Konto, ein frisches Konto erzwingt also
 * wirklich einen Zugriff auf die Platte.
 */
describe('Lesefehler zerstört keine Daten (#273)', () => {
  it('beschädigte Datei: putAnnotation wirft und der Inhalt bleibt UNVERÄNDERT erhalten', async () => {
    // Das ist der Datenverlust-Beweis: Der kaputte Inhalt ist noch rettbar (jemand kann ihn von Hand
    // reparieren). Mit der alten Fassung stand danach nur noch der neue Eintrag in der Datei.
    const user = 5101;
    const file = path.join(dir, `${user}.json`);
    const kaputt = '{"song1_vorig_1":{"strokes":"WICHTIGE-ANMERKUNG"} dann Müll';
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, kaputt, 'utf-8');

    await expect(
      mod.putAnnotation(user, 'song2_vorig_1', { strokes: 'neu', texts: [], zoom: null }),
    ).rejects.toMatchObject({ status: 500 });

    expect(await fs.readFile(file, 'utf-8')).toBe(kaputt);
  });

  it('Lesefehler: getAnnotations wirft, statt „keine Anmerkungen" zu behaupten', async () => {
    const user = 5102;
    await fs.mkdir(path.join(dir, `${user}.json`), { recursive: true }); // → EISDIR
    await expect(mod.getAnnotations(user, [])).rejects.toMatchObject({ status: 500 });
  });

  it('fehlende Datei bleibt der normale Leerfall (niemand bekommt einen Fehler)', async () => {
    const user = 5103;
    await expect(mod.getAnnotations(user, [])).resolves.toEqual({});
  });

  it('Schreibfehler hinterlässt keinen abweichenden Cache', async () => {
    // Vorher setzte `write()` den Cache VOR dem Schreiben, und die Aufrufer veränderten dabei das
    // gecachte Objekt an der Stelle. Nach einem gescheiterten Schreiben zeigte die App also einen
    // Stand, der nie auf der Platte lag – und bestätigte ihn beim nächsten Lesen.
    const user = 5104;
    await mod.putAnnotation(user, 'song1_vorig_1', { strokes: 'ALT', texts: [], zoom: null });

    // Schreiben blockieren: die .tmp-Datei ist ein Verzeichnis → EISDIR
    await fs.mkdir(path.join(dir, `${user}.json.tmp`), { recursive: true });
    await expect(
      mod.putAnnotation(user, 'song2_vorig_1', { strokes: 'NEU', texts: [], zoom: null }),
    ).rejects.toThrow();

    const stored = await mod.getAnnotations(user, []);
    expect(stored['song1_vorig_1']?.strokes).toBe('ALT');
    expect(stored['song2_vorig_1']).toBeUndefined();
  });
});
