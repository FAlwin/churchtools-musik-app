/**
 * Erkundung: **Was liefert `getCCLILyrics` – und lässt sich erkennen, ob CCLI den Abruf verbucht?**
 * (#379, Alwins Wunsch: Vorschau des Liedtexts, um gleichnamige Treffer zu unterscheiden.)
 *
 * ⚠️ **Was dieses Skript NICHT kann, und das ist der wichtigste Satz hier:**
 *
 * Ob CCLI einen Abruf als **Nutzung verbucht**, steht in CCLIs Abrechnung – **nicht** in der Antwort der
 * Schnittstelle. Kein API-Aufruf der Welt kann diese Frage beantworten. Belastbar sind nur:
 *
 *  - die **Nutzungs-/Download-Historie im SongSelect-Konto** der Gemeinde (dort taucht ein verbuchter
 *    Abruf auf – das kann nur jemand mit Zugang nachsehen),
 *  - eine Auskunft von CCLI oder dem ChurchTools-Support.
 *
 * Auch die Warnung „Ein Abruf … wird bei CCLI vermerkt" in `churchtools-songselect.md` ist eine
 * **Annahme** – ein Beleg steht dort nicht. Wer sie zitiert, zitiert also keine Messung.
 *
 * **Was hier messbar ist:**
 *
 *  1. Nimmt `getCCLILyrics` überhaupt einen Parameter an, und welchen? (`songNumber`? eine interne ID?)
 *  2. Was steht in der Antwort – kommt der Liedtext, und in welcher Form?
 *  3. **Enthält die Antwort Hinweise auf eine Verbuchung?** Felder wie `reported`, `usage`, `logged`,
 *     `downloadCount` wären ein starkes Indiz. Ihr Fehlen beweist nichts, ihr Vorhandensein viel.
 *
 * Aufruf:  npx tsx server/scripts/probe-ccli-lyrics.ts
 *
 * **STRENG LESEND, und bewusst SPARSAM:** Es wird **eine einzige** CCLI-Nummer abgefragt, und das Skript
 * bricht ab, sobald ein Parametername funktioniert – gerade weil die Verbuchungsfrage offen ist, soll die
 * Messung nicht selbst zehn Abrufe erzeugen. Nichts wird angelegt, geändert oder gelöscht; kein
 * Notenblatt wird geholt. Der Token wird nie ausgegeben.
 *
 * Bei HTTP 429 bricht das Skript SOFORT ab (#300).
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}

/**
 * **Ein** Lied, an dem gemessen wird. „All die Fülle ist in dir" – die Nummer stammt aus Alwins
 * Bildschirmfoto (ProPresenter), das Lied gehört zum Bestand der Gemeinde.
 */
const NUMMER = '4336851';

const PAUSE_MS = 500;
const schlafe = (ms: number) => new Promise((r) => setTimeout(r, ms));
let abgebrochen = false;

async function holeSitzung(): Promise<string> {
  const res = await fetch(`${BASE}/api/whoami?login_token=${encodeURIComponent(TOKEN)}`, {
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });
  const cookie = (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .filter((c) => c.startsWith('ChurchTools_'))
    .join('; ');
  if (!cookie) {
    console.error(`✗ Kein Sitzungs-Cookie erhalten (HTTP ${res.status}) – Abbruch.`);
    process.exit(1);
  }
  return cookie;
}

let SITZUNG = '';

/** Ein Aufruf der alten Schnittstelle – Sitzungs-Cookie + CSRF, wie die App es tut. */
async function ajax(
  func: string,
  felder: Record<string, string>,
): Promise<{ status: number; text: string }> {
  if (abgebrochen) return { status: 0, text: '' };
  await schlafe(PAUSE_MS);
  const csrf = await fetch(`${BASE}/api/csrftoken`, {
    headers: { Cookie: SITZUNG, Accept: 'application/json' },
  });
  const token = ((await csrf.json()) as { data?: string }).data ?? '';
  const res = await fetch(`${BASE}/index.php?q=churchservice/ajax`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Cookie: SITZUNG,
      'Content-Type': 'application/x-www-form-urlencoded',
      'CSRF-Token': token,
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ func, ...felder }),
  });
  if (res.status === 429) {
    abgebrochen = true;
    console.error('\n⛔ ChurchTools drosselt (429) – Abbruch.');
    return { status: 429, text: '' };
  }
  return { status: res.status, text: await res.text() };
}

/** Sucht in einem (auch verschachtelten) JSON nach Feldnamen, die auf eine Verbuchung hindeuten. */
function verdaechtigeFelder(roh: string): string[] {
  const muster =
    /"([a-z_]*(?:report|usage|logged|licen[cs]|count|billing|track|quota)[a-z_]*)"\s*:\s*([^,}\]]{0,40})/gi;
  const treffer = new Set<string>();
  for (const m of roh.matchAll(muster)) treffer.add(`${m[1]}: ${m[2].trim()}`);
  return [...treffer];
}

async function main(): Promise<void> {
  console.log(`\nErkundung „getCCLILyrics" (#379)\nInstanz: ${BASE}\nLied-Nummer: ${NUMMER}\n`);
  console.log('⚠️  Diese Messung kann NICHT beantworten, ob CCLI den Abruf verbucht.');
  console.log(
    '   Das steht in CCLIs Abrechnung, nicht in der Antwort. Sie zeigt nur, WAS kommt.\n',
  );

  SITZUNG = await holeSitzung();
  console.log('  (Sitzung steht.)\n');

  /* ── 1. Welchen Parameter will `getCCLILyrics`? ───────────────────────────────── */
  console.log('── 1. Parametername finden (Abbruch beim ersten Erfolg) ──\n');

  const kandidaten: Record<string, string>[] = [
    { songNumber: NUMMER },
    { ccliNumber: NUMMER },
    { songId: NUMMER },
    { id: NUMMER },
  ];

  let erfolg: { feld: string; roh: string } | null = null;

  for (const felder of kandidaten) {
    const [feld] = Object.keys(felder);
    const { status, text } = await ajax('getCCLILyrics', felder);
    if (abgebrochen) break;

    const kurz = text.slice(0, 200).replace(/\s+/g, ' ');
    const geglueckt = status === 200 && /"status"\s*:\s*"success"/.test(text);
    console.log(`  ${feld.padEnd(12)} HTTP ${status}  ${geglueckt ? '✅' : '—'}  ${kurz}`);

    if (geglueckt) {
      erfolg = { feld, roh: text };
      console.log(`\n  → Abbruch: „${feld}" funktioniert. Keine weiteren Abrufe.\n`);
      break;
    }
  }

  if (!erfolg) {
    console.log('\n  Kein Parametername hat geklappt. Mögliche Gründe:');
    console.log('   - der Aufruf braucht eine INTERNE CCLI-Song-ID (nicht die CCLI-Nummer),');
    console.log('   - oder er verlangt `browsertabId` (in der Doku als ungeprüft vermerkt).');
    console.log(
      '\n  Nächster Schritt dafür: In ChurchTools den Liedtext eines SongSelect-Treffers',
    );
    console.log(
      '  anzeigen und den Aufruf im Netzwerk-Reiter des Browsers mitlesen – so wurden die',
    );
    console.log('  beiden bekannten Aufrufe auch gefunden.\n');
    return;
  }

  /* ── 2. Was steht in der Antwort? ────────────────────────────────────────────── */
  console.log('── 2. Form der Antwort ──\n');
  console.log(`  Länge: ${erfolg.roh.length} Zeichen\n`);

  /**
   * Die drei Ebenen auspacken – dieselbe Verschachtelung wie bei den anderen SongSelect-Aufrufen
   * (`ctAjax` kennt sie): außen `{status, data}`, darin `{success, content}`, und `content` ist ein
   * **String** mit dem eigentlichen JSON von CCLI.
   */
  try {
    const aussen = JSON.parse(erfolg.roh) as { data?: { content?: string } };
    const innen = JSON.parse(aussen.data?.content ?? '{}') as { data?: Record<string, unknown> };
    const d = innen.data ?? {};
    console.log('  Felder in `data` (das ist, was CCLI liefert):');
    for (const [k, v] of Object.entries(d)) {
      const wert = typeof v === 'string' ? v : JSON.stringify(v);
      const kurz = wert.length > 300 ? `${wert.slice(0, 300)} … [${wert.length} Zeichen]` : wert;
      console.log(`    ${k.padEnd(14)} ${kurz.replace(/\n/g, ' ⏎ ')}`);
    }
    console.log('');
  } catch (e) {
    console.log(`  (Auspacken fehlgeschlagen: ${e instanceof Error ? e.message : String(e)})`);
    console.log(`  Roh: ${erfolg.roh.slice(0, 600)}\n`);
  }

  /* ── 3. Hinweise auf eine Verbuchung? ────────────────────────────────────────── */
  console.log('── 3. Felder, die auf eine Verbuchung hindeuten könnten ──\n');
  const felder = verdaechtigeFelder(erfolg.roh);
  if (felder.length === 0) {
    console.log('  Keine gefunden. **Das beweist nichts** – eine Verbuchung passiert bei CCLI und');
    console.log('  müsste sich dort nicht in der Antwort spiegeln. Es ist nur kein Indiz DAFÜR.\n');
  } else {
    for (const f of felder) console.log(`  ⚠️  ${f}`);
    console.log('\n  Das ist ein Indiz. Vor dem Bauen im SongSelect-Konto nachsehen.\n');
  }

  console.log('── Fazit ──\n');
  console.log(`  Parameter:  ${erfolg.feld}`);
  console.log('  Offen bleibt die Verbuchungsfrage – belastbar nur über die Nutzungs-Historie im');
  console.log('  SongSelect-Konto der Gemeinde oder eine Auskunft von CCLI/ChurchTools.\n');
}

void main();
