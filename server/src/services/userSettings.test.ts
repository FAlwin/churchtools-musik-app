import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

// Temporären Ablageort setzen, BEVOR das Modul (und damit config.ts) importiert wird.
const dir = path.join(os.tmpdir(), `settings-test-${process.pid}`);
process.env.ANNOTATIONS_PATH = dir;

type Mod = typeof import('./userSettings.js');
let mod: Mod;

beforeAll(async () => {
  mod = await import('./userSettings.js');
});

beforeEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

let nextUser = 5000;
/** Frisches Konto je Test – das Modul cacht pro Konto im Speicher. */
function newUser(): number {
  return ++nextUser;
}

describe('withinSettingsLimits (#195 – reine Grenzlogik)', () => {
  it('akzeptiert Werte an der Grenze, lehnt darüber ab', () => {
    expect(mod.withinSettingsLimits(mod.MAX_SETTINGS_PER_ACCOUNT, 0)).toBe(true);
    expect(mod.withinSettingsLimits(mod.MAX_SETTINGS_PER_ACCOUNT + 1, 0)).toBe(false);
    expect(mod.withinSettingsLimits(0, mod.MAX_SETTINGS_BYTES_PER_ACCOUNT)).toBe(true);
    expect(mod.withinSettingsLimits(0, mod.MAX_SETTINGS_BYTES_PER_ACCOUNT + 1)).toBe(false);
  });
});

describe('putSettings – Schlüssel-Filter', () => {
  it('übernimmt erlaubte Schlüssel und ignoriert fremde', async () => {
    const user = newUser();
    await mod.putSettings(user, { worship_key_12: 'G', boese_key: 'x', 'worship_ver_': 'y' });
    expect(await mod.getSettings(user, [])).toEqual({ worship_key_12: 'G' });
  });

  it('leerer Wert bzw. null entfernt einen Eintrag', async () => {
    const user = newUser();
    await mod.putSettings(user, { worship_key_12: 'G', worship_capo_12: '2' });
    await mod.putSettings(user, { worship_key_12: null, worship_capo_12: '' });
    expect(await mod.getSettings(user, [])).toEqual({});
  });
});

describe('putSettings – Konto-Obergrenze (#195)', () => {
  it('wirft 413, wenn ein Stapel die Eintragsgrenze überschreitet', async () => {
    const user = newUser();
    const many: Record<string, string> = {};
    for (let i = 0; i < mod.MAX_SETTINGS_PER_ACCOUNT + 5; i++) many[`worship_key_${i}`] = 'G';
    await expect(mod.putSettings(user, many)).rejects.toMatchObject({ status: 413 });
    // Nichts geschrieben – der abgelehnte Stapel darf den Store nicht halb verändert hinterlassen.
    expect(await mod.getSettings(user, [])).toEqual({});
  });

  it('wirft 413, wenn die Gesamtgröße die Byte-Grenze überschreitet', async () => {
    const user = newUser();
    const big: Record<string, string> = {};
    // 4000 Zeichen je Wert (Kappungsgrenze) × genug Einträge, um 5 MB zu reißen.
    const value = 'x'.repeat(4000);
    for (let i = 0; i < 1400; i++) big[`worship_lyrics_${i}`] = value;
    await expect(mod.putSettings(user, big)).rejects.toMatchObject({ status: 413 });
    expect(await mod.getSettings(user, [])).toEqual({});
  });

  it('Löschen bleibt möglich, auch wenn das Konto voll ist', async () => {
    const user = newUser();
    // Store bis an die Eintragsgrenze füllen (in einem erlaubten Stapel).
    const full: Record<string, string> = {};
    for (let i = 0; i < mod.MAX_SETTINGS_PER_ACCOUNT; i++) full[`worship_key_${i}`] = 'G';
    await mod.putSettings(user, full);
    expect(Object.keys(await mod.getSettings(user, [])).length).toBe(mod.MAX_SETTINGS_PER_ACCOUNT);

    // Ein weiterer Eintrag wird abgelehnt …
    await expect(mod.putSettings(user, { worship_key_999999: 'A' })).rejects.toMatchObject({
      status: 413,
    });
    // … Aufräumen aber nicht (reine Löschungen können die Grenze nie reißen).
    await mod.putSettings(user, { worship_key_0: null, worship_key_1: null });
    expect(Object.keys(await mod.getSettings(user, [])).length).toBe(
      mod.MAX_SETTINGS_PER_ACCOUNT - 2,
    );
  });

  it('bereits übergroßer Store: Aufräumen bleibt möglich, Wachsen nicht (#213)', async () => {
    // Die Grenzen sind neu – eine Bestandsdatei kann sie schon überschreiten. Dann darf die
    // Prüfung das Freiräumen nicht blockieren, sonst kommt das Konto nie wieder heraus.
    const user = newUser();
    const tooBig: Record<string, string> = {};
    const value = 'x'.repeat(4000);
    for (let i = 0; i < 1400; i++) tooBig[`worship_lyrics_${i}`] = value; // ~5,6 MB > 5 MB
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `settings-${user}.json`), JSON.stringify(tooBig), 'utf-8');

    // Wachsen ist weiterhin verboten …
    await expect(mod.putSettings(user, { worship_key_99999: 'A' })).rejects.toMatchObject({
      status: 413,
    });
    // … Aufräumen dagegen erlaubt, obwohl der Store danach IMMER NOCH über der Grenze liegt.
    await mod.putSettings(user, { worship_lyrics_0: null, worship_lyrics_1: null });
    const after = await mod.getSettings(user, []);
    expect(Object.keys(after).length).toBe(1398);
  });

  it('Wert wird auf 4000 Zeichen gekappt', async () => {
    const user = newUser();
    await mod.putSettings(user, { worship_lyrics_7: 'y'.repeat(5000) });
    const store = await mod.getSettings(user, []);
    expect(store.worship_lyrics_7).toHaveLength(4000);
  });
});

/**
 * #215: Der Filter bekam einen End-Anker. Der Test hält beide Seiten fest – was er ABWEISEN muss
 * (Müll) und was er unbedingt DURCHLASSEN muss (versionsbezogene Schlüssel). Ein zu strenges
 * `_\d+$` hätte Letztere still verworfen: Die Einstellungen wären geräteübergreifend verschwunden,
 * ohne jede Fehlermeldung.
 */
describe('SETTINGS_KEY_RE – was synchronisiert werden darf', () => {
  it('lässt die echten Schlüssel durch', () => {
    for (const k of [
      'worship_key_42',
      'worship_capo_7',
      'worship_cols_1',
      'worship_fs_1',
      'worship_lyrics_1',
      'worship_secshift_1',
      'worship_ver_1',
      'worship_view_1',
      'worship_key_42_original', // pro Version
      'worship_fs_42_akustik-2',
      'worship_cols_42_original_dlarge', // alter Geräte-Zusatz (nur noch lesend)
    ]) {
      expect(mod.SETTINGS_KEY_RE.test(k), k).toBe(true);
    }
  });

  it('weist Müll hinter der Lied-ID ab (das war die Lücke)', () => {
    for (const k of [
      'worship_key_1<Müll>',
      'worship_key_1 ',
      'worship_key_1;rm',
      'worship_key_1/../../etc',
      'worship_key_1_ORIGINAL_dlarge_zuviel',
    ]) {
      expect(mod.SETTINGS_KEY_RE.test(k), k).toBe(false);
    }
  });

  it('weist fremde Namensräume und fehlende Lied-ID ab', () => {
    for (const k of [
      'worship_docdraw_song1_voriginal_0',
      'worship_doczoom_1_0',
      'worship_key_',
      'worship_unbekannt_1',
      'key_1',
    ]) {
      expect(mod.SETTINGS_KEY_RE.test(k), k).toBe(false);
    }
  });
});
