import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

// Temporären Ablageort setzen, BEVOR das Modul (und damit config.ts) importiert wird.
const dir = path.join(os.tmpdir(), `annotations-test-${process.pid}`);
process.env.ANNOTATIONS_PATH = dir;

type Mod = typeof import('./annotations.js');
let mod: Mod;

beforeAll(async () => {
  mod = await import('./annotations.js');
});

beforeEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
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

describe('putAnnotation – Konto-Obergrenze (#139)', () => {
  const key = (n: number) => `song${n}_vorig_1`;

  it('normale Anmerkung wird gespeichert und ist wieder lesbar', async () => {
    await mod.putAnnotation(USER, key(1), { texts: [], strokes: 'data:image/png;base64,AAAA', zoom: null });
    const stored = await mod.getAnnotations(USER, [1]);
    expect(stored[key(1)]?.strokes).toBe('data:image/png;base64,AAAA');
  });

  it('wirft 413, wenn ein neuer Eintrag die Gesamtgröße über die Grenze treibt', async () => {
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
  });

  it('Löschen (leerer Eintrag) bleibt möglich, auch wenn das Konto voll ist', async () => {
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
  });
});
