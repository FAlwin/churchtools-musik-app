import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

/**
 * #273: Der Vertrag des gemeinsamen JSON-Speichers.
 *
 * Nur **„Datei gibt es noch nicht"** darf „leer" bedeuten. Jeder andere Lesefehler und beschädigtes
 * JSON müssen **werfen** – vorher legten sechs Ablagen einen leeren Stand als Wahrheit in ihren Cache,
 * und der nächste Schreibvorgang machte daraus einen echten Datenverlust.
 *
 * Die Fehler werden hier ohne `chmod` erzeugt: Ein **Verzeichnis** an der Stelle der Datei liefert
 * verlässlich `EISDIR`. `chmod 000` würde als root nicht greifen und der Test wäre still wirkungslos.
 */
const dir = path.join(os.tmpdir(), `jsonstore-test-${process.pid}`);

type Mod = typeof import('./jsonStore.js');
let mod: Mod;

beforeAll(async () => {
  mod = await import('./jsonStore.js');
});

beforeEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
});

describe('readJsonStore (#273)', () => {
  it('fehlende Datei ergibt null – der einzige erlaubte Leer-Fall', async () => {
    expect(await mod.readJsonStore(path.join(dir, 'gibtsnicht.json'), 'Test')).toBeNull();
  });

  it('vorhandene Datei wird gelesen', async () => {
    const file = path.join(dir, 'da.json');
    await fs.writeFile(file, JSON.stringify({ a: 1 }), 'utf-8');
    expect(await mod.readJsonStore(file, 'Test')).toEqual({ a: 1 });
  });

  it('Lesefehler wirft (500) – und liefert NICHT leer', async () => {
    const file = path.join(dir, 'istEinOrdner.json');
    await fs.mkdir(file); // → EISDIR beim Lesen
    await expect(mod.readJsonStore(file, 'Test')).rejects.toMatchObject({ status: 500 });
  });

  it('beschädigtes JSON wirft (500) – sonst würde der Rest überschrieben', async () => {
    const file = path.join(dir, 'kaputt.json');
    await fs.writeFile(file, '{"a":1} und dann Müll', 'utf-8');
    await expect(mod.readJsonStore(file, 'Test')).rejects.toMatchObject({ status: 500 });
  });
});

describe('writeJsonStore (#273)', () => {
  it('legt das Verzeichnis an und schreibt atomar', async () => {
    const file = path.join(dir, 'tief', 'neu.json');
    await mod.writeJsonStore(file, JSON.stringify({ b: 2 }));
    expect(JSON.parse(await fs.readFile(file, 'utf-8'))).toEqual({ b: 2 });
    // Keine Reste: die .tmp-Datei ist weggewandert, nicht liegen geblieben.
    await expect(fs.access(`${file}.tmp`)).rejects.toThrow();
  });

  it('wirft, wenn nicht geschrieben werden kann – der Aufrufer darf dann seinen Cache nicht setzen', async () => {
    const file = path.join(dir, 'blockiert.json');
    await fs.mkdir(`${file}.tmp`); // → EISDIR beim Schreiben der tmp-Datei
    await expect(mod.writeJsonStore(file, '{}')).rejects.toThrow();
  });
});
