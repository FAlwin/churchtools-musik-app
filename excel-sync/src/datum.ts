/** Datums-Helfer ohne Zeitzonen-Fallen: alles `YYYY-MM-DD`, gerechnet in UTC. */

export function heute(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Excel-Seriennummer (Tage seit 1899-12-30) oder deutsche/ISO-Schreibweise → `YYYY-MM-DD`. */
export function excelDatum(roh: unknown): string | null {
  if (typeof roh === 'number' && Number.isFinite(roh)) {
    const ms = Date.UTC(1899, 11, 30) + Math.trunc(roh) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof roh === 'string') {
    const s = roh.trim();
    let m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(s);
    if (m) {
      const jahr = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return iso(jahr, Number(m[2]), Number(m[1]));
    }
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  return null;
}

function iso(j: number, m: number, t: number): string | null {
  const d = new Date(Date.UTC(j, m - 1, t));
  if (d.getUTCFullYear() !== j || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== t) return null;
  return d.toISOString().slice(0, 10);
}

/** Alle Tage von `von` bis `bis` (einschließlich). */
export function tageZwischen(von: string, bis: string): string[] {
  const out: string[] = [];
  let t = Date.parse(`${von}T00:00:00Z`);
  const ende = Date.parse(`${bis}T00:00:00Z`);
  if (Number.isNaN(t) || Number.isNaN(ende)) return out;
  for (; t <= ende && out.length < 1000; t += 86_400_000)
    out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** `YYYY-MM` eines Tages. */
export function monat(datum: string): string {
  return datum.slice(0, 7);
}
