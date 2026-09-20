/**
 * Temporäre Ablagen für Tests – **eine Umsetzung für alle sieben** (20.09.2026).
 *
 * Sieben Testdateien legten ihren Ablageort bisher wortgleich selbst an:
 *
 * ```ts
 * const dir = path.join(os.tmpdir(), `annotations-test-${process.pid}`);
 * ```
 *
 * Zwei Dinge daran sind gefährlich, und beide haben in der CI wirklich zugeschlagen
 * (Lauf 35531036193, PR #397):
 *
 *  1. **Die Prozess-ID ist nicht eindeutig.** Betriebssysteme vergeben sie wieder; zwei gleichzeitige
 *     Läufe auf derselben Maschine können denselben Pfad treffen. Dann räumt der eine auf, während
 *     der andere schreibt. `fs.mkdtemp` würfelt stattdessen einen Namen, den es noch nicht gibt.
 *  2. **`force: true` schützt NICHT gegen `ENOTEMPTY`.** Es unterdrückt nur „gibt es nicht"
 *     (`ENOENT`). Legt jemand während des rekursiven Löschens eine neue Datei an, scheitert das
 *     abschließende `rmdir` – nachgestellt am 20.09.2026 in **60 von 60** Durchgängen. Genau das
 *     passiert, wenn ein Test in seine Zeitgrenze läuft: Seine Schreibschleife läuft weiter, während
 *     der nächste Test schon aufräumt. Deshalb räumt `leeren` hier **mit Wiederholungen**.
 *
 * **Diese Datei enthält keine Testfälle** und heißt deshalb nicht `*.test.ts` – sonst würde vitest
 * sie als leere Suite einsammeln. Dass sie trotzdem aus `vitest` importiert, ist unbedenklich: Der
 * Server läuft über `tsx src/index.ts` und lädt nur, was wirklich importiert wird – diese Datei
 * kennt außer den Tests niemand. `tsc --noEmit` prüft sie mit, mehr passiert im Bau nicht.
 */
import { afterAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Alles, was dieser Testlauf angelegt hat – und das Versprechen, es am Ende wegzuräumen.
 *
 * **Das Aufräumen registriert sich von selbst**, beim ersten angeforderten Verzeichnis. Müsste es
 * jede Testdatei eigens tun, hätte es genau eine vergessen – und mit `mkdtemp` entsteht bei JEDEM
 * Lauf ein neuer Pfad, anders als beim alten, prozessgebundenen Namen. Ohne diese Zeilen würde die
 * Verbesserung also den Temp-Ordner zumüllen.
 */
const angelegt: string[] = [];
let angemeldet = false;

function aufraeumenAnmelden(): void {
  if (angemeldet) return;
  angemeldet = true;
  afterAll(async () => {
    await Promise.all(angelegt.map((p) => leeren(p)));
  });
}

/**
 * Ein **eindeutiges** temporäres Verzeichnis für diesen Lauf.
 *
 * Bewusst **synchron**: Der Pfad muss in `process.env` stehen, **bevor** das geprüfte Modul (und
 * damit `config.ts`) importiert wird – und ein `await` auf Modulebene käme dafür zu spät.
 */
export function tempVerzeichnis(praefix: string): string {
  aufraeumenAnmelden();
  const dir = mkdtempSync(path.join(os.tmpdir(), `${praefix}-`));
  angelegt.push(dir);
  return dir;
}

/**
 * Eine **eindeutige** temporäre Datei: ein eigenes Verzeichnis, darin die Datei mit festem Namen.
 *
 * Das Verzeichnis ist der Grund – so stören sich zwei Läufe selbst dann nicht, wenn der Dateiname
 * derselbe sein muss (etwa weil der Code ihn vorgibt).
 */
export function tempDatei(praefix: string, name: string): string {
  return path.join(tempVerzeichnis(praefix), name);
}

/**
 * Löscht eine Datei oder ein Verzeichnis samt Inhalt – **mit Wiederholungen**.
 *
 * Für das `beforeEach` der Tests gedacht. Die Wiederholungen sind der eigentliche Zweck: Sie
 * überbrücken die Nachwirkungen eines Tests, der in seine Zeitgrenze gelaufen ist und noch schreibt.
 * Ohne sie meldet der **nächste** Test einen Fehler, der nichts mit ihm zu tun hat – und die Suche
 * beginnt an der falschen Stelle.
 */
export async function leeren(pfad: string): Promise<void> {
  // Node wartet je Versuch `retryDelay` LÄNGER als beim vorigen (linear): 20 Versuche à 20 ms sind
  // in Summe gut 4 Sekunden Geduld – genug für die Nachwehen eines abgebrochenen Tests, und trotzdem
  // eine Grenze, damit ein echter Dauerschreiber nicht ewig verdeckt bleibt.
  await fs.rm(pfad, { recursive: true, force: true, maxRetries: 20, retryDelay: 20 });
}
