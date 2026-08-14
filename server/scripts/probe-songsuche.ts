/**
 * Erkundung: **Kann man im Liedtext suchen – und ab wann lohnt eine CCLI-Nummer?** (#322, Alwins Frage
 * vom 13.08.2026: „wäre es auch möglich im Inhalt des Liedes zu suchen, wenn man den Titel nicht
 * genau kennt?")
 *
 * Drei Fragen, alle **nicht** aus der Doku beantwortbar:
 *
 *  1. **Gibt es bei CCLI eine Textsuche?** Bekannt ist nur `getCCLISongsMatchingTitle`. Für Text/Lyrics
 *     steht in `churchtools-songselect.md` ausdrücklich „geraten, nicht gemessen". Hier werden
 *     naheliegende Namen probiert.
 *  2. **Kann ChurchTools selbst im eigenen Bestand suchen?** Wenn `/api/songs` (oder die globale Suche)
 *     einen Textparameter kennt, wäre das der billige Weg. Andernfalls müsste unser Server die
 *     ChordPro-Dateien selbst durchsuchen – 49 Downloads je Suche, also die #300-Falle.
 *  3. **Wie viele Stellen haben CCLI-Nummern in der Praxis?** Danach richtet sich, ab wann eine reine
 *     Zifferneingabe automatisch als Nummer abgefragt werden darf, ohne beim Tippen dauernd „nicht
 *     gefunden" zu melden. Bisher wäre diese Schwelle geraten.
 *
 * Aufruf:  npx tsx server/scripts/probe-songsuche.ts
 *
 * **STRENG LESEND.** Nur Abfragen; nichts wird angelegt, geändert oder gelöscht. Die Aufrufe der alten
 * Schnittstelle sind POSTs, die **nur lesen** (sie kennt keine GETs) – dieselbe Unterscheidung wie in
 * `probe-songmgmt.ts`. Der Token wird nie ausgegeben.
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

const PAUSE_MS = 450;
const schlafe = (ms: number) => new Promise((r) => setTimeout(r, ms));
let abgebrochen = false;

async function hole(pfad: string): Promise<{ status: number; text: string }> {
  if (abgebrochen) return { status: 0, text: '' };
  await schlafe(PAUSE_MS);
  const res = await fetch(`${BASE}${pfad}`, {
    headers: { Authorization: `Login ${TOKEN}`, Accept: 'application/json' },
  });
  if (res.status === 429) {
    abgebrochen = true;
    console.error('\n⛔ ChurchTools drosselt (429) – Abbruch.');
    return { status: 429, text: '' };
  }
  return { status: res.status, text: await res.text() };
}

/**
 * Die alte Schnittstelle braucht ein **Sitzungs-Cookie**, kein Login-Token (steht so in
 * `churchtools-songselect.md`). Mit reinem Token antwortet ChurchTools mit einer Weiterleitung auf die
 * Anmeldeseite – im ersten Versuch lief das Skript deshalb in „redirect count exceeded".
 *
 * Der Token lässt sich in eine Sitzung einlösen: `GET /api/whoami?login_token=…` beantwortet die Frage
 * „wer bin ich" **und** setzt dabei das Cookie. Genau diesen Weg nimmt auch die App beim Anmelden.
 */
async function holeSitzung(): Promise<string> {
  const res = await fetch(`${BASE}/api/whoami?login_token=${encodeURIComponent(TOKEN)}`, {
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  const cookie = cookies
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

/** Ein Aufruf der alten Schnittstelle – mit Sitzungs-Cookie und CSRF-Token, wie es die App tut. */
async function ajax(func: string, felder: Record<string, string>): Promise<string> {
  if (abgebrochen) return '';
  await schlafe(PAUSE_MS);
  const csrf = await fetch(`${BASE}/api/csrftoken`, {
    headers: { Cookie: SITZUNG, Accept: 'application/json' },
  });
  const token = ((await csrf.json()) as { data?: string }).data ?? '';
  const body = new URLSearchParams({ func, ...felder });
  const res = await fetch(`${BASE}/index.php?q=churchservice/ajax`, {
    method: 'POST',
    // `manual`: Eine Weiterleitung ist hier eine AUSSAGE (nicht angemeldet), kein Umweg, dem man folgt.
    redirect: 'manual',
    headers: {
      Cookie: SITZUNG,
      'Content-Type': 'application/x-www-form-urlencoded',
      'CSRF-Token': token,
    },
    body,
  });
  if (res.status === 429) {
    abgebrochen = true;
    console.error('\n⛔ ChurchTools drosselt (429) – Abbruch.');
    return '';
  }
  const text = (await res.text()).slice(0, 260).replace(/\s+/g, ' ');
  return `${res.status} ${text}`;
}

async function main(): Promise<void> {
  console.log(`\nErkundung „Suche im Liedtext"\nInstanz: ${BASE}\n`);
  SITZUNG = await holeSitzung();
  console.log('  (Sitzung steht – die alte Schnittstelle braucht ein Cookie, kein Token.)\n');

  /* ── 1. Gibt es bei CCLI eine Textsuche? ─────────────────────────────────────── */
  console.log('── 1. CCLI: Funktionsnamen für eine Textsuche ────────');
  console.log('   (400/„success" = Funktion existiert; „Unknown function"/404 = Name falsch)\n');
  for (const func of [
    'getCCLISongsMatchingLyrics',
    'getCCLISongsMatchingText',
    'getCCLISongsMatchingContent',
    'getCCLISongsMatchingAuthor',
    'getCCLISongsMatching',
    'searchCCLISongs',
    'getCCLISongs',
    'getCCLILyrics',
  ]) {
    console.log(
      `  ${func.padEnd(30)} ${await ajax(func, { searchTerm: 'gnade', songTitle: 'gnade' })}`,
    );
  }

  /* ── 2. Kann ChurchTools im eigenen Bestand suchen? ──────────────────────────── */
  console.log('\n── 2. ChurchTools: Suchparameter am eigenen Bestand ──');
  for (const pfad of [
    '/api/songs?query=gnade&limit=3',
    '/api/songs?searchTerm=gnade&limit=3',
    '/api/songs?name=gnade&limit=3',
    '/api/search?query=gnade&domainTypes[]=song',
  ]) {
    const a = await hole(pfad);
    // Wie viele Lieder kommen zurück? Bei einem ignorierten Parameter sind es ALLE – das ist der Test.
    let anzahl = '—';
    try {
      const j = JSON.parse(a.text) as { data?: unknown[] };
      if (Array.isArray(j.data)) anzahl = String(j.data.length);
    } catch {
      /* kein JSON */
    }
    console.log(`  ${pfad.padEnd(48)} ${a.status}  Treffer: ${anzahl}`);
  }
  console.log(
    '  Deutung: Kommen bei „query=gnade" GENAUSO viele Lieder wie ohne Parameter, ignoriert\n' +
      '  ChurchTools ihn – dann gibt es dort keine Suche, auf die wir aufsetzen können.',
  );
  const alle = await hole('/api/songs?limit=200');
  let gesamt = 0;
  const stellen = new Map<number, number>();
  let mitNummer = 0;
  try {
    const j = JSON.parse(alle.text) as { data?: { ccli?: string | null }[] };
    const lieder = j.data ?? [];
    gesamt = lieder.length;
    for (const l of lieder) {
      const n = String(l.ccli ?? '').trim();
      if (!n) continue;
      mitNummer++;
      stellen.set(n.length, (stellen.get(n.length) ?? 0) + 1);
    }
  } catch {
    /* nichts */
  }
  console.log(`  Ohne Parameter: ${gesamt} Lieder`);

  /**
   * ── 2b. Sucht `query=` nur im TITEL oder auch im TEXT? ─────────────────────────
   *
   * Das ist die Frage, an der alles hängt. `query=gnade` filtert (1 von 50) – aber „Gnade" steht auch
   * in einem Titel. Deshalb wird jetzt ein Wort gesucht, das **im Liedtext** vorkommt und **nicht im
   * Titel**: Dazu wird ein ChordPro geladen und ein markantes Wort daraus genommen.
   */
  console.log('\n── 2b. Sucht `query=` auch im Liedtext? ──────────────');
  const eins = await hole('/api/songs?limit=1');
  let songId = 0;
  let songName = '';
  try {
    const j = JSON.parse(eins.text) as {
      data?: {
        id: number;
        name: string;
        arrangements?: { files?: { name: string; fileUrl: string }[] }[];
      }[];
    };
    const lied = j.data?.[0];
    songId = lied?.id ?? 0;
    songName = lied?.name ?? '';
    const datei = lied?.arrangements?.[0]?.files?.find((f) => /\.chordpro$/i.test(f.name));
    if (!datei) {
      console.log(`  („${songName}" hat kein ChordPro – Textprobe nicht möglich.)`);
    } else {
      /**
       * **Mit Sitzungs-Cookie, nicht mit Token** – der erste Versuch scheiterte an „fetch failed":
       * Die Datei-URLs von ChurchTools hängen an der Sitzung, nicht am Login-Token. Genau das tut
       * `fetchFileBytes` im Server auch.
       */
      const antwort = await fetch(datei.fileUrl, {
        headers: { Cookie: SITZUNG },
        redirect: 'follow',
      });
      const inhalt = antwort.ok ? await antwort.text() : '';
      if (!antwort.ok) console.log(`  (ChordPro nicht ladbar: HTTP ${antwort.status})`);
      // Ein langes Wort aus der Mitte des Textes, das NICHT im Titel steht.
      const titelWorte = new Set(songName.toLowerCase().split(/\W+/));
      const worte = [...inhalt.matchAll(/[A-Za-zÄÖÜäöüß]{7,}/g)]
        .map((m) => m[0])
        .filter((w) => !titelWorte.has(w.toLowerCase()))
        .filter((w) => !/^(chordpro|comment|subtitle|copyright)$/i.test(w));
      const probe = worte[Math.floor(worte.length / 2)];
      console.log(`  Lied „${songName}" (#${songId}), Wort aus dem TEXT: „${probe}"`);
      const treffer = await hole(`/api/songs?query=${encodeURIComponent(probe ?? '')}&limit=50`);
      let anzahl = -1;
      try {
        anzahl = ((JSON.parse(treffer.text) as { data?: unknown[] }).data ?? []).length;
      } catch {
        /* nichts */
      }
      console.log(
        anzahl > 0
          ? `  🟢 ${anzahl} Treffer → ChurchTools durchsucht AUCH den Liedtext.`
          : `  🔴 ${anzahl} Treffer → \`query=\` sucht NUR in den Stammdaten (Titel/Autor), nicht im Text.`,
      );
      // Gegenprobe: Ein Wort AUS DEM TITEL muss gefunden werden – sonst misst der Test etwas anderes.
      const titelWort = songName.split(/\W+/).find((w) => w.length >= 4) ?? songName;
      const t2 = await hole(`/api/songs?query=${encodeURIComponent(titelWort)}&limit=50`);
      let a2 = -1;
      try {
        a2 = ((JSON.parse(t2.text) as { data?: unknown[] }).data ?? []).length;
      } catch {
        /* nichts */
      }
      console.log(
        `  Gegenprobe mit dem Titelwort „${titelWort}": ${a2} Treffer` +
          (a2 > 0
            ? ' (der Parameter wirkt also wirklich)'
            : ' ⚠️ auch 0 – dann misst der Test nichts!'),
      );
    }
  } catch (e) {
    console.log(`  (Textprobe nicht möglich: ${e instanceof Error ? e.message : String(e)})`);
  }

  /* ── 3. Wie lang sind CCLI-Nummern in der Praxis? ────────────────────────────── */
  console.log('\n── 3. Stellenzahl der CCLI-Nummern im Bestand ────────');
  console.log(`  Lieder mit Nummer: ${mitNummer} von ${gesamt}`);
  for (const [laenge, anzahl] of [...stellen.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${laenge} Stellen: ${anzahl}×`);
  }
  const kuerzeste = Math.min(...stellen.keys());
  console.log(
    Number.isFinite(kuerzeste)
      ? `  → Kürzeste Nummer hat ${kuerzeste} Stellen. Erst ab dieser Länge automatisch abfragen.`
      : '  → Keine Nummern im Bestand – Schwelle bleibt offen.',
  );

  console.log('\nFertig. Nichts wurde verändert.\n');
}

void main();
