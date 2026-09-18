/**
 * Erkundung: Welche Felder liefert ChurchTools bei den **eigenen** Abwesenheiten? (#177)
 *
 * Anlass (05.09.2026): In der App steht bei Alt-Einträgen „ChurchTools" statt eines Grundes – das
 * Feld `absenceReason` kommt also offenbar nicht mit. Bevor daran etwas geändert wird, wird gemessen.
 *
 * **Rein lesend.** Es wird nichts angelegt, geändert oder gelöscht. Gelesen wird ausschließlich das
 * EIGENE Konto (aus `whoami`). Ausgegeben werden Feldnamen und Grund-Angaben, keine Kommentartexte –
 * die können Persönliches enthalten.
 *
 * Aufruf im Projektstamm:  npx tsx server/scripts/probe-absences.ts
 * Braucht in der `.env`:   CHURCHTOOLS_BASE_URL + CHURCHTOOLS_LOGIN_TOKEN (Entwickler-Token, #384).
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}

/** Holt per Login-Token ein Sitzungs-Cookie – die alten Endpunkte brauchen es (CLAUDE.md). */
async function sitzung(): Promise<string> {
  const res = await fetch(`${BASE}/api/whoami?login_token=${encodeURIComponent(TOKEN)}`, {
    redirect: 'manual',
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  if (!cookie) throw new Error(`Kein Cookie erhalten (HTTP ${res.status}).`);
  const json = (await res.json()) as { data?: { id?: number; firstName?: string } };
  const id = json.data?.id;
  if (typeof id !== 'number' || id <= 0) throw new Error('Kein gültiges Konto in whoami.');
  console.log(`✓ Angemeldet als Person ${id}`);
  process.env.__PERSON = String(id);
  return cookie;
}

async function main(): Promise<void> {
  const cookie = await sitzung();
  const personId = process.env.__PERSON;

  for (const variante of [
    { name: 'ohne Zusatz', q: '' },
    { name: 'mit include=absenceReason', q: '&include=absenceReason' },
    { name: 'mit include=all', q: '&include=all' },
  ]) {
    const url = `${BASE}/api/persons/${personId}/absences?from=2024-01-01&to=2027-12-31&limit=5${variante.q}`;
    const res = await fetch(url, { headers: { Cookie: cookie, Accept: 'application/json' } });
    if (!res.ok) {
      console.log(`\n— ${variante.name}: HTTP ${res.status}`);
      continue;
    }
    const json = (await res.json()) as { data?: Record<string, unknown>[] };
    const zeilen = json.data ?? [];
    console.log(`\n— ${variante.name}: ${zeilen.length} Einträge`);
    if (zeilen.length === 0) continue;
    console.log('  Felder:', Object.keys(zeilen[0]).join(', '));
    for (const z of zeilen) {
      const grund = z.absenceReason as { id?: number; name?: string } | null | undefined;
      console.log(
        `  ${String(z.startDate)} – ${String(z.endDate)} | absenceReasonId=${String(
          (z as { absenceReasonId?: unknown }).absenceReasonId,
        )} | absenceReason=${grund ? `${grund.id} „${grund.name}"` : String(grund)} | Kommentar: ${
          typeof z.comment === 'string' && z.comment.length > 0
            ? `${z.comment.length} Zeichen${z.comment.startsWith('[Musikteam]') ? ' MIT Marker' : ' ohne Marker'}`
            : 'leer'
        }`,
      );
    }
  }

  /**
   * **Wo gibt ChurchTools die Abwesenheitsgründe heraus?** (Wunsch Alwin, 05.09.2026: Die Auswahl in
   * der App soll aus ChurchTools kommen, „man kann da Gründe einstellen" – also keine fest
   * verdrahtete Liste.) Die Namen der Standardgründe sind Übersetzungsschlüssel
   * (`absent.reason.absence`), selbst angelegte tragen vermutlich echte Namen.
   *
   * Nur GET, mehrere Kandidaten – der erste, der 200 liefert, gewinnt.
   */
  const kandidaten = [
    '/api/masterdata/absencereasons',
    '/api/absencereasons',
    '/api/absencereason',
    '/api/person/masterdata',
    '/api/persons/masterdata',
    '/api/masterdata',
    '/api/absences/masterdata',
    '/api/config',
  ];
  for (const pfad of kandidaten) {
    const res = await fetch(`${BASE}${pfad}`, {
      headers: { Cookie: cookie, Accept: 'application/json' },
    });
    if (!res.ok) {
      console.log(`\n— ${pfad}: HTTP ${res.status}`);
      continue;
    }
    const json = (await res.json()) as { data?: unknown };
    const daten = json.data ?? json;
    console.log(`\n— ${pfad}: HTTP 200`);
    if (Array.isArray(daten)) {
      for (const g of daten.slice(0, 20)) {
        const o = g as { id?: unknown; name?: unknown; nameTranslated?: unknown };
        console.log(`  ${String(o.id)} = „${String(o.nameTranslated ?? o.name)}"`);
      }
    } else if (daten && typeof daten === 'object') {
      const schluessel = Object.keys(daten as Record<string, unknown>);
      console.log('  Schlüssel:', schluessel.slice(0, 40).join(', '));
      // Enthält einer davon „absence"? Dann dort hineinsehen.
      for (const k of schluessel.filter((s) => /absen/i.test(s))) {
        const wert = (daten as Record<string, unknown>)[k];
        console.log(`  → ${k}:`, JSON.stringify(wert).slice(0, 400));
      }
    }
  }

  // Letzte Möglichkeit: die alte Schnittstelle, über die auch Lied-Kategorien kommen (#322).
  for (const modul of ['churchdb', 'churchservice']) {
    const csrf = await fetch(`${BASE}/api/csrftoken`, {
      headers: { Cookie: cookie, Accept: 'application/json' },
    })
      .then((r) => r.json() as Promise<{ data?: string }>)
      .then((j) => j.data ?? '');
    const res = await fetch(`${BASE}/index.php?q=${modul}/ajax`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'CSRF-Token': csrf,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ func: 'getMasterData' }),
    });
    const roh = await res.text();
    console.log(`\n— ${modul}/ajax getMasterData: HTTP ${res.status}`);
    if (!res.ok) continue;
    try {
      const json = JSON.parse(roh) as { data?: Record<string, unknown> };
      const d = json.data ?? {};
      const treffer = Object.keys(d).filter((k) => /absen/i.test(k));
      console.log('  Schlüssel mit „absen":', treffer.join(', ') || '(keine)');
      for (const k of treffer) console.log(`  → ${k}:`, JSON.stringify(d[k]).slice(0, 500));
    } catch {
      console.log('  (keine lesbare JSON-Antwort)');
    }
  }
}

main().catch((e: unknown) => {
  console.error('✗', e instanceof Error ? e.message : e);
  process.exit(1);
});
