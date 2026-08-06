/**
 * Klärt EINE Frage: Verrät `/api/events` schon, ob ein Termin einen Ablaufplan hat? (#306)
 *
 * ── WARUM ────────────────────────────────────────────────────────────────────────────────────────
 * Die Lied-Statistik holt für jeden Termin der letzten vier Jahre den Ablaufplan. Der erste
 * Betriebslauf nach v2.16.1 zeigte: **223 Termine, aber nur 48 haben überhaupt einen Ablauf.**
 * 175 Anfragen (78 %) laufen ins Leere und antworten mit 404 – und genau dieser Massenlauf hat
 * ChurchTools zu HTTP 429 gebracht (#300).
 *
 * Bevor wir uns selbst merken, welche Termine keinen Ablauf haben (und damit riskieren, einen später
 * nachgetragenen Ablauf **still** zu übersehen), ist die bessere Frage: **Sagt ChurchTools es uns
 * vielleicht schon?** Dann sparen wir die Anfragen ohne jeden eigenen Zustand und ohne Risiko.
 *
 * Unser `CtEvent`-Typ deklariert nur die Felder, die wir NUTZEN – die API liefert womöglich mehr.
 *
 * ── WAS DAS SKRIPT TUT ───────────────────────────────────────────────────────────────────────────
 *   1. Holt die Termine eines kurzen Zeitraums (1 Anfrage) und gibt **alle** Feldnamen aus.
 *   2. Gibt einen vollständigen Termin als JSON aus – da sieht man, ob etwas wie `agenda`,
 *      `hasAgenda`, `agendaId` dabei ist.
 *   3. Gibt `meta` aus (verwirft `ctGet` sonst) – klärt nebenbei die Paginierungsfrage aus #300.
 *   4. Probiert die üblichen ChurchTools-Erweiterungen: `?include=agenda`, `?include=agendas`.
 *   5. Prüft an EINEM Termin gegen, was `/api/events/{id}/agenda` sagt – stimmt das Kennzeichen?
 *
 * ── HARMLOS ──────────────────────────────────────────────────────────────────────────────────────
 * Nur lesende Anfragen, **höchstens acht Stück**. Kein Schreiben, keine Last, kein Rate-Limit-Risiko.
 * Das Token wird nie ausgegeben.
 *
 * ── AUFRUF ───────────────────────────────────────────────────────────────────────────────────────
 *   npx tsx server/scripts/probe-events-agenda.ts
 *
 * Liest `CHURCHTOOLS_BASE_URL` + `CHURCHTOOLS_LOGIN_TOKEN` aus der `.env`.
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}

let cookie = '';

async function anmelden(): Promise<void> {
  const res = await fetch(`${BASE}/api/whoami?login_token=${encodeURIComponent(TOKEN)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error(`✗ Anmeldung fehlgeschlagen: HTTP ${res.status}`);
    process.exit(1);
  }
  const setCookie =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get('set-cookie') ?? ''];
  for (const c of setCookie) {
    const m = c.match(/^(ChurchTools_[^=]+=[^;]+)/);
    if (m) cookie = m[1];
  }
  if (!cookie) {
    console.error('✗ Keine Sitzung erhalten.');
    process.exit(1);
  }
}

async function holen(pfad: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${BASE}${pfad}`, {
    headers: { Cookie: cookie, Accept: 'application/json' },
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

/** Feldnamen eines Objekts, damit man auf einen Blick sieht, was CT liefert. */
function felder(o: unknown): string {
  return o && typeof o === 'object'
    ? Object.keys(o as object)
        .sort()
        .join(', ')
    : '(kein Objekt)';
}

async function main(): Promise<void> {
  console.log('Liefert /api/events ein Kennzeichen für „hat Ablaufplan"? (#306)');
  console.log('──────────────────────────────────────────────────────────────');
  console.log('Nur lesende Anfragen, höchstens acht.\n');
  await anmelden();

  // Kurzes Fenster genügt – wir wollen die STRUKTUR sehen, nicht viele Termine.
  const heute = new Date();
  const vor90 = new Date(heute);
  vor90.setDate(vor90.getDate() - 90);
  const from = vor90.toISOString().slice(0, 10);
  const to = heute.toISOString().slice(0, 10);

  const { status, json } = await holen(`/api/events?from=${from}&to=${to}`);
  console.log(`GET /api/events → HTTP ${status}`);
  const body = json as { data?: unknown[]; meta?: unknown };
  const liste = body.data ?? [];
  console.log(`Termine im Fenster (90 Tage): ${liste.length}`);
  console.log(`meta: ${body.meta ? JSON.stringify(body.meta) : '(keins – keine Paginierung)'}\n`);

  if (liste.length === 0) {
    console.log('Keine Termine – bitte das Fenster vergrößern.');
    return;
  }

  console.log('── Felder eines Termins ─────────────────────────────');
  console.log(felder(liste[0]));
  console.log('\n── Ein vollständiger Termin ─────────────────────────');
  console.log(JSON.stringify(liste[0], null, 2).slice(0, 1500));

  // Verrät eines der Felder etwas über einen Ablauf?
  const verdaechtig = Object.keys((liste[0] ?? {}) as object).filter((k) =>
    /agenda|songs?|program|ablauf/i.test(k),
  );
  console.log(
    `\n→ Felder mit Bezug zu „Ablauf/Lieder": ${verdaechtig.length ? verdaechtig.join(', ') : 'KEINE'}`,
  );

  console.log('\n── Unterstützt CT ein include? ──────────────────────');
  for (const inc of ['agenda', 'agendas']) {
    const r = await holen(`/api/events?from=${from}&to=${to}&include=${inc}`);
    const erste = (r.json as { data?: unknown[] })?.data?.[0];
    const neu = Object.keys((erste ?? {}) as object).filter(
      (k) => !Object.keys((liste[0] ?? {}) as object).includes(k),
    );
    console.log(
      `?include=${inc} → HTTP ${r.status}` +
        (neu.length ? `  ← NEUE Felder: ${neu.join(', ')}` : '  (keine zusätzlichen Felder)'),
    );
  }

  // Gegenprobe an zwei Terminen: Stimmt ein etwaiges Kennzeichen mit der Wirklichkeit überein?
  console.log('\n── Gegenprobe: hat der Termin wirklich einen Ablauf? ─');
  for (const ev of liste.slice(0, 3) as { id: number; startDate?: string }[]) {
    const a = await holen(`/api/events/${ev.id}/agenda`);
    const punkte = (a.json as { data?: { items?: unknown[] } })?.data?.items?.length ?? 0;
    console.log(
      `  Termin ${ev.id} (${ev.startDate?.slice(0, 10) ?? '?'}) → HTTP ${a.status}` +
        (a.status === 200 ? `, ${punkte} Ablaufpunkte` : ' (kein Ablaufplan)'),
    );
  }

  console.log('\n── Was das bedeutet ─────────────────────────────────');
  console.log(
    verdaechtig.length
      ? 'Es gibt ein Feld mit Ablauf-Bezug → wir können die 175 Anfragen OHNE eigenen Merker sparen.'
      : 'Kein Kennzeichen in /api/events → wir brauchen einen eigenen Merker (mit Nachprüf-Regel,\n' +
          'damit ein nachgetragener Ablauf nicht still übersehen wird).',
  );
}

void main();
