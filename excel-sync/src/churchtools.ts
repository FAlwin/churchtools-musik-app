/**
 * ChurchTools mit SERVICE-Token (`Authorization: Login <token>`) – der Dienst schreibt für alle
 * Musiker, deshalb kein Nutzer-Cookie. Nur das Nötigste: Person finden, Abwesenheiten lesen,
 * anlegen, löschen. Was angefasst werden darf, entscheidet `sync.ts` über die Marker-Konvention aus
 * `@shared/absences` – hier steht keine Regel darüber.
 */
import { config } from './config.js';

export class CtGedrosselt extends Error {
  constructor(public readonly retryAfterS: number | null) {
    super('ChurchTools drosselt (429).');
  }
}

export interface CtAbsence {
  id: number;
  startDate: string;
  endDate: string;
  comment?: string | null;
  absenceReason?: { id?: number; name?: string } | null;
}

async function ct<T>(method: 'GET' | 'POST' | 'DELETE', pfad: string, body?: unknown): Promise<T> {
  const res = await fetch(`${config.churchtoolsBaseUrl}/api${pfad}`, {
    method,
    headers: {
      Authorization: `Login ${config.churchtoolsServiceToken}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 429) {
    const ra = res.headers.get('retry-after');
    throw new CtGedrosselt(ra && /^\d+$/.test(ra) ? Number(ra) : null);
  }
  if (method === 'DELETE' && (res.status === 204 || res.status === 404)) return undefined as T;
  if (!res.ok)
    throw new Error(`ChurchTools ${method} ${pfad.replace(/\d+/g, '<id>')} → HTTP ${res.status}`);
  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as { data?: T };
  return (json.data ?? json) as T;
}

const personCache = new Map<string, number | null>();

/** Exakter Treffer Vorname + Nachname (wie der Alt-Planner); sonst `null` – nie raten. */
export async function findePerson(name: string): Promise<number | null> {
  const key = name.trim().toLowerCase();
  if (personCache.has(key)) return personCache.get(key) ?? null;
  const rows = await ct<Array<{ id: number; firstName?: string; lastName?: string }>>(
    'GET',
    `/persons?query=${encodeURIComponent(name.trim())}&limit=50`,
  );
  const treffer = (rows ?? []).find(
    (p) =>
      `${(p.firstName ?? '').trim()} ${(p.lastName ?? '').trim()}`.trim().toLowerCase() === key,
  );
  const id = treffer?.id ?? null;
  personCache.set(key, id);
  return id;
}

export function __resetPersonCacheForTests(): void {
  personCache.clear();
}

export async function ladeAbwesenheiten(
  personId: number,
  von: string,
  bis: string,
): Promise<CtAbsence[]> {
  const q = new URLSearchParams({ from: von, to: bis, limit: '500' });
  return (await ct<CtAbsence[]>('GET', `/persons/${personId}/absences?${q.toString()}`)) ?? [];
}

export async function legeAbwesenheitAn(
  personId: number,
  body: { startDate: string; endDate: string; absenceReasonId: number; comment: string },
): Promise<void> {
  await ct('POST', `/persons/${personId}/absences`, body);
}

export async function loescheAbwesenheit(personId: number, absenceId: number): Promise<void> {
  await ct('DELETE', `/persons/${personId}/absences/${absenceId}`);
}
