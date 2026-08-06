/**
 * Die Rechte-Policy – **die subtilste Stelle des Projekts** (#280).
 *
 * Sie beantwortet: Darf dieser Mensch Abläufe sehen, Abläufe bearbeiten, Lied-Einstellungen ändern,
 * fremde Anmerkungen lesen? Ein Fehler hier gibt entweder Rechte an Unbefugte oder sperrt das
 * Worship-Team aus – beides fällt im Gottesdienst auf.
 *
 * Zwei Dinge, die man beim Ändern wissen muss:
 *  - **Ein ChurchTools-Aussetzer darf niemanden aussperren** (#149): Ist die Rechte-Antwort leer, wird
 *    aus dem Cache überbrückt. Aber NICHT blind – ein 401 von `whoami` heißt „Sitzung ist tot" und
 *    führt zum Login statt in die „Erneut versuchen"-Sackgasse.
 *  - **Was fremde Daten freigibt, wird NIE überbrückt** (#249/#282): `isAdmin` und
 *    `canUseGlobalNotes` gelten nur bei einer frischen Antwort.
 *
 * Die reinen Ableitungen (`parseCapabilities`, `computeTeamNotesAllowed`) sind absichtlich frei von
 * HTTP – sie lassen sich ohne Netz durchtesten.
 */
import { config } from '../config.js';
import { HttpError } from '../middleware/errorHandler.js';
import { getCachedCapabilities, rememberCapabilities } from './capabilitiesCache.js';
import { getUserId } from './ctAuth.js';
import { ctGet } from './ctHttp.js';
import { capsMemo } from './ctSessionMemos.js';
import { getSiteConfig } from './siteConfig.js';
import type { NoteRolePerm, UserCapabilities } from '@shared/types/index';

/**
 * Ermittelt aus den ChurchTools-Rechten (Modul churchservice), was der Nutzer darf.
 * `knownUserId` kommt aus dem Session-Cookie (seit #149) – damit funktioniert die Cache-
 * Überbrückung auch, wenn `whoami` während eines ChurchTools-Aussetzers nicht antwortet.
 */
export async function getCapabilities(
  cookie: string,
  knownUserId: number | null = null,
): Promise<UserCapabilities> {
  const data = await ctGet<Record<string, Record<string, unknown>>>(
    cookie,
    '/api/permissions/global',
  );

  // Konto-ID für den Rechte-Cache: bevorzugt aus dem Session-Cookie (kein Netz nötig); sonst
  // best effort via whoami (12 h gecacht). Ein 401 von whoami wird gemerkt: Er heißt, die
  // CT-Session ist (halb) tot – kann dann auch der Cache nicht überbrücken, führen wir den
  // Nutzer per 401 zum Login statt in die „Erneut versuchen"-Sackgasse (#149, Bezug #104).
  let userId: number | null = knownUserId;
  let whoamiUnauthorized = false;
  if (userId == null) {
    try {
      userId = await getUserId(cookie);
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) whoamiUnauthorized = true;
      /* whoami nicht erreichbar → ohne Cache fortfahren */
    }
  }

  // ChurchTools liefert bei einem Aussetzer entweder eine komplett leere Antwort (parseCapabilities
  // wirft) ODER den churchservice-Block mit leeren Rechte-Arrays (→ „alles false"). Beides sieht aus
  // wie „kein Zugriff". In beiden Fällen überbrücken wir mit den zuletzt gültigen Rechten aus dem
  // Cache; nur wenn es dort nichts gibt, greift das reguläre Verhalten (echt kein Zugriff / Fehler).
  const bridgeFromCache = async (): Promise<UserCapabilities | null> => {
    if (userId == null) return null;
    const cached = await getCachedCapabilities(userId);
    if (cached) {
      console.warn(
        '[capabilities] leere/blockierte ChurchTools-Antwort – zuletzt gültige Rechte aus Cache geliefert',
      );
      return cached;
    }
    return null;
  };

  let base: UserCapabilities;
  try {
    base = parseCapabilities(data);
  } catch (err) {
    // Komplett leere Antwort (totaler Aussetzer). Cache überbrückt; sonst Fehler durchreichen
    // (der Client bietet dann „Erneut versuchen" an).
    const cached = await bridgeFromCache();
    if (cached) return cached;
    throw err;
  }

  if (!base.canViewSongs && !base.canViewAgendas) {
    // Rechte-Arrays leer: Aussetzer ODER echt kein Zugriff. Cache überbrückt den Aussetzer; ohne
    // Cache als „kein Zugriff" zurückgeben (Client zeigt den Hinweis) – ein „alles false" wird
    // bewusst NIE gecacht, daher sperrt der Cache echte Nicht-Berechtigte nie fälschlich ein.
    const cached = await bridgeFromCache();
    if (cached) return cached;
    // Diagnose (#149): WARUM konnte nicht überbrückt werden? Ohne diesen Grund war der reale
    // Vorfall vom 13.07.2026 (12× keine Überbrückung) im Log nicht aufklärbar.
    const grund =
      userId == null
        ? whoamiUnauthorized
          ? 'whoami lieferte 401 – CT-Session (halb) tot'
          : 'Konto-ID unbekannt (whoami fehlgeschlagen, keine ID im Cookie)'
        : `kein frischer Cache-Eintrag für Konto ${userId}`;
    console.warn(
      `[capabilities] keine Lieder/Abläufe-Rechte geliefert (evtl. ChurchTools-Aussetzer); nicht überbrückt: ${grund}`,
    );
    // Halb tote CT-Session (Rechte leer + whoami 401) und kein Cache: „Erneut versuchen" ist
    // zwecklos, nur ein Re-Login (neue CT-Session) hilft → 401 führt den Client zum Login (#104).
    if (whoamiUnauthorized) {
      throw new HttpError(401, 'Session abgelaufen. Bitte neu anmelden.');
    }
    return { ...base, canUseGlobalNotes: false };
  }

  // Team-Notizen: kein Admin-Bypass. Das Nutzungsrecht (teilen + ansehen) ergibt sich aus der
  // aktiven Gruppen-Mitgliedschaft + der je Gruppe freigegebenen Rolle. Leer = niemand.
  const { musicianGroupIds, noteRoles = [] } = await getSiteConfig();
  let canUseGlobalNotes = false;
  if (musicianGroupIds.length > 0 && userId != null) {
    const memberships = await getActiveMemberships(cookie, userId);
    canUseGlobalNotes = computeTeamNotesAllowed(memberships, musicianGroupIds, noteRoles);
  }

  const full: UserCapabilities = { ...base, canUseGlobalNotes };
  // Gültige Rechte merken → überbrückt künftige Aussetzer. Best effort, blockiert die Antwort nicht.
  if (userId != null) void rememberCapabilities(userId, full);
  return full;
}

/**
 * Reine Berechtigungs-Logik (testbar, ohne Netz): Darf der Nutzer Team-Notizen nutzen
 * (eigene teilen + geteilte ansehen)? Je gewählter Gruppe zählt die freigegebene Rolle;
 * leere/fehlende Rollen-Freigabe einer Gruppe = NIEMAND (kein „alle").
 */
export function computeTeamNotesAllowed(
  memberships: Array<{ groupId: number; roleId: number }>,
  musicianGroupIds: number[],
  noteRoles: NoteRolePerm[],
): boolean {
  const selected = new Set(musicianGroupIds);
  const rolesByGroup = new Map<number, number[]>();
  for (const r of noteRoles) rolesByGroup.set(r.groupId, r.roles);
  return memberships.some(
    (m) => selected.has(m.groupId) && (rolesByGroup.get(m.groupId) ?? []).includes(m.roleId),
  );
}

/** Capabilities mit 5-Minuten-Memo je Session – für häufige Rechte-Checks (Team-Notizen). */
export async function getCapabilitiesCached(
  cookie: string,
  knownUserId: number | null = null,
): Promise<UserCapabilities> {
  const hit = capsMemo.get(cookie);
  if (hit !== undefined) return hit;
  const caps = await getCapabilities(cookie, knownUserId);
  capsMemo.set(cookie, caps);
  return caps;
}

/**
 * Aktive Mitgliedschaften des Nutzers als {Gruppe, Rolle} (via `/api/persons/{id}/groups`).
 * Die Gruppen-ID steht in `group.domainIdentifier` (String), die Rolle in `groupTypeRoleId`.
 * Nur aktive, nicht beendete Mitgliedschaften zählen.
 */
export async function getActiveMemberships(
  cookie: string,
  userId: number,
): Promise<Array<{ groupId: number; roleId: number }>> {
  interface Membership {
    group?: { domainIdentifier?: string | number };
    groupTypeRoleId?: number;
    groupMemberStatus?: string;
    memberEndDate?: string | null;
  }
  const rows = await ctGet<Membership[]>(cookie, `/api/persons/${userId}/groups`);
  const out: Array<{ groupId: number; roleId: number }> = [];
  for (const r of rows ?? []) {
    if (r.groupMemberStatus !== 'active' || r.memberEndDate) continue;
    const groupId = Number(r.group?.domainIdentifier);
    const roleId = Number(r.groupTypeRoleId);
    if (Number.isInteger(groupId) && Number.isInteger(roleId)) out.push({ groupId, roleId });
  }
  return out;
}

/** Sichtbare ChurchTools-Gruppen (id + name), alphabetisch – für das Admin-Dropdown „Gruppen-Zuweisung". */
export async function getGroups(cookie: string): Promise<{ id: number; name: string }[]> {
  interface Group {
    id: number;
    name: string;
  }
  // limit hoch genug für ein Dropdown; page=1 (CT beginnt bei 1, nicht 0).
  const rows = await ctGet<Group[]>(cookie, '/api/groups?limit=200&page=1');
  return (rows ?? [])
    .filter((g) => Number.isInteger(g.id) && Boolean(g.name))
    .map((g) => ({ id: g.id, name: g.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/**
 * Rollen einer Gruppe (id = `groupTypeRoleId`, name) für die Rollen-Zuweisung. Versteckte Rollen
 * (`isHidden`) werden ausgelassen. Quelle: `GET /api/groups/{id}/roles`.
 */
export async function getGroupRoles(
  cookie: string,
  groupId: number,
): Promise<{ id: number; name: string }[]> {
  interface Role {
    groupTypeRoleId?: number;
    name?: string;
    isHidden?: boolean;
  }
  const rows = await ctGet<Role[]>(cookie, `/api/groups/${groupId}/roles`);
  return (rows ?? [])
    .filter((r) => !r.isHidden && Number.isInteger(r.groupTypeRoleId) && Boolean(r.name))
    .map((r) => ({ id: r.groupTypeRoleId as number, name: r.name as string }));
}

/**
 * Wertet die ChurchTools-Rechte-Antwort (`/api/permissions/global`) aus.
 *
 * WICHTIG: Eine gültige Antwort enthält für jeden angemeldeten Nutzer IMMER mindestens einen
 * Modul-Block. Eine komplett leere Antwort ist daher NICHT „der Nutzer hat keine Rechte", sondern
 * ein vorübergehender Aussetzer (kurz überlastetes/inkonsistentes ChurchTools, wackelige
 * Verbindung). Wir werfen dann, damit der Client automatisch neu versucht – statt fälschlich das
 * endgültige „keine Berechtigung"-Schloss zu zeigen. Fehlt hingegen nur der churchservice-Block
 * (andere Module sind vorhanden), hat der Nutzer wirklich keine Lieder-/Ablauf-Rechte → reguläre
 * false-Werte ohne Wurf.
 */
export function parseCapabilities(
  data: Record<string, Record<string, unknown>> | null | undefined,
): UserCapabilities {
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    throw new HttpError(502, 'Leere Rechte-Antwort von ChurchTools – bitte erneut versuchen.');
  }
  const cs = data.churchservice ?? {};
  const has = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : Boolean(v));
  // Admin-Recht aus der Konfiguration (Form `modul:recht`).
  const [adminModule, adminPerm] = config.adminPermission.split(':');
  const isAdmin = has(data[adminModule]?.[adminPerm]);
  // Ein Admin darf ohnehin alles – auch ohne explizit zugewiesene Kategorie-/Kalender-Rechte.
  return {
    canViewSongs: isAdmin || has(cs['view songcategory']),
    canViewAgendas: isAdmin || has(cs['view agenda']),
    canEditAgendas: isAdmin || has(cs['edit agenda']),
    canEditSongs: isAdmin || has(cs['edit songcategory']),
    isAdmin,
    // Default; die tatsächliche Gruppen-/Rollen-Prüfung ergänzt getCapabilities (braucht Cookie + Config).
    canUseGlobalNotes: false,
  };
}
