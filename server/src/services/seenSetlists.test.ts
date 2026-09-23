import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { leeren, tempDatei } from '../testHilfen/tempAblage.js';

// Ablageort VOR dem Modul-Import setzen (config.ts liest beim Import).
const file = tempDatei('seen-setlists-test', 'seen.json');
process.env.SEEN_SETLISTS_PATH = file;

type Mod = typeof import('./seenSetlists.js');
let mod: Mod;

beforeAll(async () => {
  mod = await import('./seenSetlists.js');
});

beforeEach(async () => {
  await leeren(file);
  mod.__resetForTests();
});

const USER = 42;

describe('seenSetlists (#143 – zuletzt gesehener Setlist-Stand je Konto)', () => {
  it('nichts gemerkt → leeres Objekt', async () => {
    expect(await mod.getSeenSetlists(USER)).toEqual({});
  });

  it('markSeen merkt den Fingerabdruck je Termin und ist wieder lesbar', async () => {
    await mod.markSeenSetlist(USER, 1001, 'hashA', undefined, 1_000_000);
    await mod.markSeenSetlist(USER, 1002, 'hashB', undefined, 1_000_000);
    const seen = await mod.getSeenSetlists(USER);
    expect(seen['1001']?.hash).toBe('hashA');
    expect(seen['1002']?.hash).toBe('hashB');
  });

  it('erneutes markSeen überschreibt den Stand desselben Termins', async () => {
    await mod.markSeenSetlist(USER, 1001, 'alt', undefined, 1_000_000);
    await mod.markSeenSetlist(USER, 1001, 'neu', undefined, 2_000_000);
    const seen = await mod.getSeenSetlists(USER);
    expect(seen['1001']?.hash).toBe('neu');
  });

  it('Konten sind getrennt', async () => {
    await mod.markSeenSetlist(USER, 1001, 'hashA', undefined, 1_000_000);
    expect(await mod.getSeenSetlists(99)).toEqual({});
  });

  it('räumt Einträge älter als 180 Tage beim nächsten Schreiben aus', async () => {
    const t0 = 1_000_000_000_000;
    await mod.markSeenSetlist(USER, 1001, 'alt', undefined, t0);
    // 181 Tage später ein anderer Termin → der alte Eintrag fällt raus.
    const later = t0 + 181 * 24 * 60 * 60 * 1000;
    await mod.markSeenSetlist(USER, 1002, 'neu', undefined, later);
    const seen = await mod.getSeenSetlists(USER);
    expect(seen['1001']).toBeUndefined();
    expect(seen['1002']?.hash).toBe('neu');
  });
});

/**
 * **Eine unlesbare Ablage wird nicht überschrieben** (#404). Vorher wurde jeder Lesefehler als „leer"
 * übernommen und beim nächsten Schreiben zurückgeschrieben – die Daten ALLER Konten waren weg.
 * Geprüft mit einer beschädigten Datei statt mit entzogenen Rechten: Das trifft genau den Fall und
 * hängt nicht davon ab, unter welchem Benutzer die Tests laufen (als root griffe `chmod 000` nicht).
 */
describe('Gesehene Abläufe – beschädigte Datei (#404)', () => {
  it('überschreibt sie nicht und liefert beim Lesen „nichts gemerkt" statt eines Fehlers', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{"kaputt": ', 'utf-8');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    await mod.markSeenSetlist(USER, 1001, 'hashA');
    expect(await mod.getSeenSetlists(USER)).toEqual({});

    expect(await fs.readFile(file, 'utf-8')).toBe('{"kaputt": ');
    expect(errors).toHaveBeenCalled(); // laut – ein Blick aufs Volume ist nötig
    errors.mockRestore();
  });
});
