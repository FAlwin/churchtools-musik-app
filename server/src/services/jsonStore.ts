/**
 * Gemeinsames Lesen/Schreiben der JSON-Ablagen auf dem Volume (#273).
 *
 * Das Projekt hat sechs solche Ablagen (Anmerkungen, Lied-Einstellungen, Teilen-Tabelle,
 * Branding, gesehene Setlists, Rechte-Cache) und jede hatte ihre eigene Kopie derselben zwei
 * Vorgänge – **mit demselben Fehler**: `try { JSON.parse(await readFile(...)) } catch { leer }`.
 *
 * Warum das gefährlich ist: „Leer" wurde als **Wahrheit** in den Cache gelegt. Bei `EACCES`,
 * `EIO`, `EMFILE` oder einer beschädigten Datei schrieb der nächste Speichervorgang diesen leeren
 * Stand samt dem einen neuen Eintrag zurück – **alle übrigen Daten des Kontos waren damit weg**.
 * Nur „Datei gibt es noch nicht" (`ENOENT`) darf „leer" bedeuten; jeder andere Lesefehler ist
 * vorübergehend oder ein Betriebsproblem und muss laut scheitern, statt Daten zu vernichten.
 *
 * Das ist dieselbe Lehre wie #245, #249, #251 und #270: **vorübergehend ist nicht ungültig.** Sie
 * lag an vier Stellen umgesetzt und an sechs Stellen nicht – deshalb steht sie jetzt hier an EINER.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Liest eine JSON-Ablage.
 *
 * - Datei gibt es nicht → `null` (der Aufrufer nimmt seinen Leer-/Standardwert)
 * - Lesefehler oder beschädigtes JSON → **wirft** (500). Die Datei bleibt unangetastet.
 *
 * `was` benennt die Ablage für die Fehlermeldung („Anmerkungen", „Lied-Einstellungen", …).
 */
export async function readJsonStore<T>(file: string, was: string): Promise<T | null> {
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf-8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    console.error(`${was}: Lesen von ${file} fehlgeschlagen:`, e instanceof Error ? e.message : e);
    throw new HttpError(
      500,
      `${was} konnten gerade nicht gelesen werden. Bitte später erneut versuchen.`,
    );
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    // Bewusst laut: Eine beschädigte Datei darf NICHT als „leer" durchgehen, sonst überschreibt der
    // nächste Speichervorgang den Rest. Lieber ein sichtbarer Fehler und ein Blick aufs Volume.
    console.error(
      `${was}: ${file} ist beschädigt (kein gültiges JSON):`,
      e instanceof Error ? e.message : e,
    );
    throw new HttpError(
      500,
      `${was} sind beschädigt und wurden nicht überschrieben. Bitte den Betreiber informieren.`,
    );
  }
}

/**
 * Schreibt eine JSON-Ablage atomar (Verzeichnis anlegen → `.tmp` → `rename`).
 *
 * Wirft bei Fehlschlag. **Der Aufrufer darf seinen Cache erst danach setzen** – sonst zeigt der
 * Cache einen Stand, der nie auf der Platte gelandet ist, und die nächste Leseanfrage bestätigt ihn.
 */
export async function writeJsonStore(file: string, serialized: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, serialized, 'utf-8');
  await fs.rename(tmp, file);
}
