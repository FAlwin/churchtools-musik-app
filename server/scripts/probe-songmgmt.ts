/**
 * Erkundung: Was gibt die ChurchTools-API für eine **Liedverwaltung in der App** wirklich her?
 *
 * Hintergrund: Die App kann heute ChordPro-Versionen anlegen/ändern/löschen. Der Wunsch geht weiter –
 * Lieder anlegen, Dateien hoch- und runterladen, Stammdaten pflegen. Eine Recherche vom 26.06.2026
 * kam zum Ergebnis „möglich, aber die REST-Endpunkte für Lieder sind noch nicht ganz rund". Das ist
 * alt; dieses Skript prüft den heutigen Stand an der echten Instanz.
 *
 * Aufruf:  npx tsx server/scripts/probe-songmgmt.ts
 *
 * **STRENG LESEND.** Es werden ausschließlich GET-Anfragen gestellt – nichts wird angelegt,
 * geändert oder gelöscht. Der Token wird nie ausgegeben.
 *
 * Bei HTTP 429 (Drosselung) bricht das Skript SOFORT ab: Unsere eigene App hat ChurchTools schon
 * einmal überfahren (#300), danach scheiterten Login, Rechte und Speichern gleichzeitig. Das
 * passiert kein zweites Mal wegen eines Erkundungs-Skripts.
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}

/** Pause zwischen zwei Anfragen – bewusst gemütlich, das hier hat es nicht eilig. */
const PAUSE_MS = 400;

interface Antwort {
  status: number;
  json: unknown;
}

let abgebrochen = false;

async function get(pfad: string): Promise<Antwort> {
  if (abgebrochen) return { status: 0, json: null };
  await new Promise((r) => setTimeout(r, PAUSE_MS));
  const res = await fetch(`${BASE}${pfad}`, {
    headers: { Authorization: `Login ${TOKEN}`, Accept: 'application/json' },
  });
  if (res.status === 429) {
    abgebrochen = true;
    console.error('\n⛔ ChurchTools drosselt (429) – Abbruch. Später erneut versuchen.');
    return { status: 429, json: null };
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    json = text.slice(0, 200);
  }
  return { status: res.status, json };
}

/** Kurzform: gibt es den Endpunkt, und wie sieht die Antwort grob aus? */
async function pruefe(name: string, pfad: string): Promise<Antwort> {
  const a = await get(pfad);
  if (a.status === 0) return a;
  const zeichen = a.status === 200 ? '✓' : a.status === 403 ? '⊘' : a.status === 404 ? '✗' : '?';
  const hinweis =
    a.status === 403 ? ' (keine Berechtigung)' : a.status === 404 ? ' (gibt es nicht)' : '';
  console.log(`  ${zeichen} ${String(a.status).padEnd(3)} ${name}${hinweis}`);
  return a;
}

/** Die Felder eines Datensatzes auflisten – daraus folgt, was ein Anlege-Formular können muss. */
function felder(json: unknown): string[] {
  const d = (json as { data?: unknown })?.data;
  const erst = Array.isArray(d) ? d[0] : d;
  return erst && typeof erst === 'object' ? Object.keys(erst as object).sort() : [];
}

async function main(): Promise<void> {
  console.log(`\nChurchTools-Erkundung „Liedverwaltung" – NUR LESEND\nInstanz: ${BASE}\n`);

  console.log('── Grundlagen ──');
  const info = await pruefe('Instanz-Info (Version)', '/api/info');
  const v = (info.json as { build?: string; version?: string } | null) ?? {};
  if (v.version || v.build)
    console.log(`      → Version ${v.version ?? '?'} (Build ${v.build ?? '?'})`);

  console.log('\n── Lieder lesen ──');
  const liste = await pruefe('Liedliste', '/api/songs?limit=1');
  const songFelder = felder(liste.json);
  if (songFelder.length) console.log(`      → Felder: ${songFelder.join(', ')}`);

  const d = (liste.json as { data?: { id?: number }[] } | null)?.data;
  const songId = Array.isArray(d) && d[0]?.id ? d[0].id : null;
  if (!songId) {
    console.log('\n⚠️  Kein Lied gefunden – die folgenden Prüfungen brauchen eins.');
    return;
  }
  console.log(`      → Beispiel-Lied #${songId}`);

  const einzeln = await pruefe(`Einzelnes Lied #${songId}`, `/api/songs/${songId}`);
  const einzelFelder = felder(einzeln.json);
  if (einzelFelder.length) console.log(`      → Felder: ${einzelFelder.join(', ')}`);

  // Arrangements: hängen Tonart, Tempo und Dateien dran (wichtig für Wunsch „Arrangements abbilden")
  const arr = (einzeln.json as { data?: { arrangements?: Record<string, unknown>[] } } | null)?.data
    ?.arrangements;
  if (Array.isArray(arr) && arr[0]) {
    console.log(
      `      → ${arr.length} Arrangement(s), Felder: ${Object.keys(arr[0]).sort().join(', ')}`,
    );
  }

  console.log('\n── Stammdaten, die ein Anlege-Formular bräuchte ──');
  const kat = await pruefe('Lied-Kategorien', '/api/songcategories');
  if (felder(kat.json).length) console.log(`      → Felder: ${felder(kat.json).join(', ')}`);
  await pruefe('Tonarten (musical keys)', '/api/musicalkeys');
  await pruefe('Masterdata Lieder', '/api/masterdata/songs');

  console.log('\n── Dateien am Arrangement ──');
  const arrId = Array.isArray(arr) && typeof arr[0]?.id === 'number' ? (arr[0].id as number) : null;
  if (arrId) {
    const dateien = await pruefe(
      `Dateien von Arrangement #${arrId}`,
      `/api/files/song_arrangement/${arrId}`,
    );
    if (felder(dateien.json).length)
      console.log(`      → Felder: ${felder(dateien.json).join(', ')}`);
  }

  console.log('\n── Wo die Schreibwege dokumentiert wären ──');
  await pruefe('OpenAPI/Swagger-Beschreibung', '/api/swagger.json');
  await pruefe('Alternative: /api/docs', '/api/docs');

  console.log('\n── Rechte des angemeldeten Kontos ──');
  const perm = await pruefe('Eigene Berechtigungen', '/api/permissions/global');
  const songRechte = (perm.json as { data?: { song?: Record<string, unknown> } } | null)?.data
    ?.song;
  if (songRechte) console.log(`      → song: ${JSON.stringify(songRechte)}`);

  console.log('\nFertig. Nichts wurde verändert.\n');
}

main().catch((e: unknown) => {
  console.error('\n✗ Abbruch:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
