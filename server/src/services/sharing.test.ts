import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

/**
 * #276: „Teilen abschalten" darf keinen Erfolg melden, wenn nichts gespeichert wurde.
 *
 * `write()` schluckte Schreibfehler vollständig (`.then(() => {}, () => {})`), `setSharing` lief
 * trotzdem durch und der Controller antwortete 200. Wer sein Teilen **abschaltete**, bekam
 * „gespeichert" – nach dem nächsten Container-Neustart (Cache weg) teilte er weiter. Das ist der
 * Fall, der zählt: Die Person glaubt, ihre Anmerkungen sind nicht mehr sichtbar.
 *
 * Dazu #273 für dieselbe Datei: Sie gilt für **ALLE** Konten. Ein Lesefehler, der als „leer" durchgeht,
 * hätte beim nächsten Umschalten die Teilen-Einstellungen der ganzen Gemeinde gelöscht.
 *
 * Fehler ohne `chmod`: ein **Verzeichnis** an der Stelle der Datei bzw. der `.tmp`-Datei liefert
 * verlässlich `EISDIR` – `chmod 000` greift als root nicht und der Test wäre still wirkungslos.
 */
const dir = path.join(os.tmpdir(), `sharing-test-${process.pid}`);
process.env.ANNOTATIONS_PATH = dir;

type Mod = typeof import('./sharing.js');
let mod: Mod;

beforeAll(async () => {
  mod = await import('./sharing.js');
});

beforeEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
  mod.__resetForTests();
});

const file = (): string => path.join(dir, 'sharing.json');

describe('setSharing – Normalfall', () => {
  it('einschalten, lesen, abschalten', async () => {
    await mod.setSharing(7, 'Test Musiker', true);
    expect(await mod.isSharing(7)).toBe(true);
    expect(await mod.listSharers()).toEqual([{ id: 7, name: 'Test Musiker' }]);

    await mod.setSharing(7, 'Test Musiker', false);
    expect(await mod.isSharing(7)).toBe(false);
    expect(await mod.listSharers()).toEqual([]);
  });

  it('überlebt einen Neustart – der Stand liegt auf der Platte, nicht nur im Cache', async () => {
    await mod.setSharing(8, 'Zweiter', true);
    mod.__resetForTests(); // wie ein Container-Neustart
    expect(await mod.isSharing(8)).toBe(true);
  });
});

describe('Schreibfehler wird gemeldet, nicht geschluckt (#276)', () => {
  it('setSharing wirft, wenn nicht geschrieben werden kann', async () => {
    await fs.mkdir(`${file()}.tmp`, { recursive: true }); // → EISDIR beim Schreiben
    await expect(mod.setSharing(9, 'Dritter', true)).rejects.toThrow();
  });

  it('ABSCHALTEN meldet keinen Erfolg, wenn es nicht gespeichert wurde', async () => {
    // Der eigentliche Fall: Erst echt einschalten, dann das Schreiben blockieren und abschalten.
    // Vorher lief das ohne Fehler durch – und nach einem Neustart teilte die Person weiter.
    await mod.setSharing(10, 'Vierter', true);
    await fs.mkdir(`${file()}.tmp`, { recursive: true });

    await expect(mod.setSharing(10, 'Vierter', false)).rejects.toThrow();

    // Nichts gespeichert → nach einem Neustart steht weiter „teilt". Genau das MUSS der Nutzer
    // erfahren, statt es für erledigt zu halten.
    mod.__resetForTests();
    await fs.rm(`${file()}.tmp`, { recursive: true, force: true });
    expect(await mod.isSharing(10)).toBe(true);
  });

  it('ein gescheitertes Schreiben hinterlässt keinen abweichenden Cache (#273)', async () => {
    await mod.setSharing(11, 'Fünfter', true);
    await fs.mkdir(`${file()}.tmp`, { recursive: true });
    await expect(mod.setSharing(11, 'Fünfter', false)).rejects.toThrow();
    // Der Cache darf NICHT bereits „abgeschaltet" zeigen – das wäre ein Stand, den es nie gab.
    expect(await mod.isSharing(11)).toBe(true);
  });

  it('nach einem Fehlschlag funktioniert das nächste Schreiben wieder (Kette bleibt intakt)', async () => {
    await fs.mkdir(`${file()}.tmp`, { recursive: true });
    await expect(mod.setSharing(12, 'Sechster', true)).rejects.toThrow();

    await fs.rm(`${file()}.tmp`, { recursive: true, force: true });
    await expect(mod.setSharing(12, 'Sechster', true)).resolves.toBeUndefined();
    expect(await mod.isSharing(12)).toBe(true);
  });
});

describe('Lesefehler löscht nicht die Tabelle der ganzen Gemeinde (#273)', () => {
  it('beschädigte Datei: setSharing wirft und der Inhalt bleibt UNVERÄNDERT', async () => {
    const kaputt = '{"7":{"name":"Wichtig","enabled":true} kein gültiges JSON';
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file(), kaputt, 'utf-8');

    await expect(mod.setSharing(99, 'Neuer', true)).rejects.toMatchObject({ status: 500 });
    expect(await fs.readFile(file(), 'utf-8')).toBe(kaputt);
  });

  it('fehlende Datei bleibt der normale Leerfall', async () => {
    expect(await mod.listSharers()).toEqual([]);
  });
});
