/**
 * Diagnose für #124 Etappe 2 (globale Notizen – „wer darf verwalten" per CT-Rolle):
 * Klärt an der echten ChurchTools-Instanz zwei Fragen:
 *   (a) Welche ROLLE hat eine Person in einer Gruppe? (Feld in /api/persons/{id}/groups)
 *   (b) Wie liste ich die verfügbaren Rollen einer Gruppe / eines Gruppentyps auf?
 *       (für das Admin-Dropdown „diese Rollen dürfen verwalten")
 *
 * Nur lesend. Token wird NIE ausgegeben.
 *
 * Aufruf:  GROUP_ID=9 npx tsx server/scripts/probe-group-roles.ts
 * (GROUP_ID default 9 = ECG-Musikteam.) Liest CHURCHTOOLS_BASE_URL + CHURCHTOOLS_LOGIN_TOKEN aus .env.
 */
import 'dotenv/config';

const BASE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_LOGIN_TOKEN ?? '';
const GROUP_ID = Number(process.env.GROUP_ID ?? '9');

if (!BASE || !TOKEN) {
  console.error('✗ CHURCHTOOLS_BASE_URL oder CHURCHTOOLS_LOGIN_TOKEN fehlt in der .env.');
  process.exit(1);
}

let COOKIE = '';

function extractSessionCookie(res: Response): string | null {
  const cookies =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie') as string]
        : [];
  for (const c of cookies) {
    const m = c.match(/^(ChurchTools_[^=]+=[^;]+)/);
    if (m) return m[1];
  }
  return null;
}

let MY_ID = 0;

async function authenticate(): Promise<void> {
  const res = await fetch(`${BASE}/api/whoami?login_token=${encodeURIComponent(TOKEN)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`whoami fehlgeschlagen: ${res.status}`);
  const cookie = extractSessionCookie(res);
  if (!cookie) throw new Error('Kein Session-Cookie erhalten.');
  COOKIE = cookie;
  const me = (await res.json()) as { data?: { id?: number; firstName?: string; lastName?: string } };
  MY_ID = me.data?.id ?? 0;
  console.log(`✓ Angemeldet als ${me.data?.firstName ?? '?'} ${me.data?.lastName ?? ''} (id ${MY_ID})`);
}

async function ctGet(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: COOKIE, Accept: 'application/json' },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function show(label: string, value: unknown): void {
  console.log(`\n── ${label} ─────────────────────────────`);
  console.log(JSON.stringify(value, null, 2));
}

async function main(): Promise<void> {
  await authenticate();

  // (a) Meine Mitgliedschaften – welche Felder beschreiben die Rolle in der Gruppe?
  const mine = await ctGet(`/api/persons/${MY_ID}/groups`);
  const rows = (mine.body as { data?: unknown[] })?.data ?? [];
  console.log(`\n[a] /api/persons/${MY_ID}/groups → status ${mine.status}, ${rows.length} Einträge`);
  // Nur die interessante Gruppe (falls Mitglied) + ansonsten den ERSTEN Eintrag komplett dumpen,
  // damit wir alle Felder einer Mitgliedschaft sehen (v. a. rollenbezogene).
  const forGroup = (rows as Array<{ group?: { domainIdentifier?: string | number } }>).find(
    (r) => Number(r.group?.domainIdentifier) === GROUP_ID,
  );
  show(`Mitgliedschaft in Gruppe ${GROUP_ID} (VOLL) – oder undefined, wenn nicht Mitglied`, forGroup);
  if (!forGroup && rows.length) show('Ersatzweise: erste Mitgliedschaft (VOLL)', rows[0]);

  // (b1) Die Gruppe selbst – enthält sie den Gruppentyp (groupTypeId)?
  const group = await ctGet(`/api/groups/${GROUP_ID}`);
  const g = (group.body as { data?: Record<string, unknown> })?.data ?? {};
  console.log(`\n[b1] /api/groups/${GROUP_ID} → status ${group.status}`);
  show('Gruppe: ausgewählte Felder', {
    id: g.id,
    name: g.name,
    groupTypeId: (g.information as Record<string, unknown> | undefined)?.groupTypeId ?? g.groupTypeId,
    information: g.information,
  });

  // (b2) Rollen-Listen an verschiedenen bekannten Endpunkten ausprobieren.
  for (const path of [
    '/api/group/roles',
    '/api/masterdata/groupTypeRoles',
    '/api/masterdata/groups/roles',
    `/api/groups/${GROUP_ID}/roles`,
  ]) {
    const r = await ctGet(path);
    const data = (r.body as { data?: unknown })?.data;
    console.log(`\n[b2] GET ${path} → status ${r.status}${data ? '' : ' (keine data)'}`);
    if (data) {
      // Bei großen Listen nur die ersten 8 Einträge zeigen.
      const preview = Array.isArray(data) ? data.slice(0, 8) : data;
      show(`Antwort ${path} (gekürzt)`, preview);
    }
  }

  console.log('\n✓ Fertig. Bitte die komplette Ausgabe hierher kopieren.');
}

main().catch((e) => {
  console.error('✗ Fehler:', e instanceof Error ? e.message : e);
  process.exit(1);
});
