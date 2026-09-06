/**
 * Die Musikteam-Excel über Microsoft Graph – lesen als Ganzes, schreiben zeilenweise.
 *
 * **Aufbau des Blatts** (aus dem Alt-Planner `graph_client.parse_excel_structure`, gemessen):
 *  - Zeile 0: Monatsüberschriften · Zeile 1: Datumsseriennummern ab Spalte 2
 *  - ab Zeile 2: Spalte 0 = Name, Spalte 1 = „X" wenn aktiv, ab Spalte 2 je Datum:
 *    „X" = abwesend, „B"/„O" = eingeteilt (Dienst), leer = verfügbar
 *  - Sonderzeilen: „Besonderheiten" (Hinweise je Datum), „Planung abgeschlossen" („X" = Monat gesperrt)
 *  - Ausgeblendete Zeilen (`rowHidden`) zählen nicht.
 *
 * **Schreibregel:** Es wird immer die ganze Zeile aus dem gelesenen Stand zurückgeschrieben, nur mit
 * den geänderten Zellen – so bleiben „B"/„O" und alles Unbekannte stehen. Der Alt-Planner schrieb
 * „X"/leer für ALLE Datumsspalten und hätte damit Einteilungen gelöscht.
 */
import { config } from './config.js';
import { excelDatum } from './datum.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';

export interface Datumsspalte {
  col: number;
  datum: string;
}
export interface MusikerZeile {
  name: string;
  row: number;
  /** Spalten mit „X". */
  abwesend: Set<number>;
  /** Spalten mit „B"/„O" – hier steht eine Einteilung, die nie überschrieben wird. */
  eingeteilt: Set<number>;
}
export interface Blatt {
  werte: unknown[][];
  daten: Datumsspalte[];
  musiker: MusikerZeile[];
  gesperrteMonate: Set<string>;
}

const SONDERZEILEN = new Set(['besonderheiten', 'name', 'planung abgeschlossen']);

function zelle(row: unknown[], col: number): string {
  const v = row[col];
  // Graph liefert je Zelle Text, Zahl, `null` oder `false` – alles andere (Objekte) gibt es dort
  // nicht und würde als „[object Object]" durchrutschen, statt aufzufallen.
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

/** Reine Funktion: Rohwerte → Struktur. Ohne Netz testbar. */
export function parseBlatt(werte: unknown[][], rowHidden: boolean[] = []): Blatt {
  const leer: Blatt = { werte, daten: [], musiker: [], gesperrteMonate: new Set() };
  if (!Array.isArray(werte) || werte.length < 3) return leer;
  const daten: Datumsspalte[] = [];
  const datumZeile = werte[1] ?? [];
  for (let col = 2; col < datumZeile.length; col++) {
    const d = excelDatum(datumZeile[col]);
    if (d) daten.push({ col, datum: d });
  }
  const musiker: MusikerZeile[] = [];
  const gesperrteMonate = new Set<string>();
  for (let row = 2; row < werte.length; row++) {
    if (rowHidden[row]) continue;
    const zeile = werte[row] ?? [];
    const name = zelle(zeile, 0);
    if (!name) continue;
    if (name.toLowerCase() === 'planung abgeschlossen') {
      for (const d of daten)
        if (zelle(zeile, d.col).toUpperCase() === 'X') gesperrteMonate.add(d.datum.slice(0, 7));
      continue;
    }
    if (SONDERZEILEN.has(name.toLowerCase())) continue;
    if (zelle(zeile, 1).toUpperCase() !== 'X') continue; // nur aktive Musiker
    const abwesend = new Set<number>();
    const eingeteilt = new Set<number>();
    for (const d of daten) {
      const v = zelle(zeile, d.col).toUpperCase();
      if (v === 'X') abwesend.add(d.col);
      else if (v === 'B' || v === 'O') eingeteilt.add(d.col);
    }
    musiker.push({ name, row, abwesend, eingeteilt });
  }
  return { werte, daten, musiker, gesperrteMonate };
}

/** Spaltenindex (0-basiert) → Excel-Buchstaben. */
export function spaltenBuchstabe(idx: number): string {
  let s = '';
  let n = idx + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/* ------------------------------------------------------------------ Graph */

let tokenCache: { token: string; bis: number } | null = null;

async function accessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.bis) return tokenCache.token;
  const res = await fetch(
    `https://login.microsoftonline.com/${config.azureTenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.azureClientId,
        client_secret: config.azureClientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok) throw new Error(`Graph-Anmeldung fehlgeschlagen (HTTP ${res.status}).`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('Graph-Anmeldung ohne Token.');
  tokenCache = {
    token: json.access_token,
    bis: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000,
  };
  return json.access_token;
}

function blattPfad(): string {
  return `/users/${encodeURIComponent(config.onedriveUser)}/drive/items/${config.excelFileId}/workbook/worksheets/${encodeURIComponent(config.excelWorksheet)}`;
}

async function graph(method: 'GET' | 'PATCH', pfad: string, body?: unknown): Promise<unknown> {
  const token = await accessToken();
  const res = await fetch(`${GRAPH}${pfad}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429) {
    throw new Error(
      `Graph drosselt (429, Retry-After ${res.headers.get('retry-after') ?? '?'} s).`,
    );
  }
  if (!res.ok) throw new Error(`Graph ${method} fehlgeschlagen (HTTP ${res.status}).`);
  return res.json();
}

/** Das ganze Blatt (usedRange) inklusive ausgeblendeter Zeilen. */
export async function ladeBlatt(): Promise<Blatt> {
  const data = (await graph('GET', `${blattPfad()}/usedRange`)) as {
    values?: unknown[][];
    rowHidden?: unknown[][];
  };
  const hidden = (data.rowHidden ?? []).map((r) => Array.isArray(r) && Boolean(r[0]));
  return parseBlatt(data.values ?? [], hidden);
}

/**
 * Schreibt eine Musiker-Zeile im Bereich der Datumsspalten – aus dem gelesenen Stand, nur mit den
 * gewünschten Änderungen (`setzen`: Spalte → „X" oder „").
 */
export async function schreibeZeile(
  blatt: Blatt,
  row: number,
  setzen: Map<number, 'X' | ''>,
): Promise<void> {
  if (blatt.daten.length === 0 || setzen.size === 0) return;
  const min = blatt.daten[0].col;
  const max = blatt.daten[blatt.daten.length - 1].col;
  const zeile = blatt.werte[row] ?? [];
  const values: unknown[] = [];
  for (let col = min; col <= max; col++) {
    const neu = setzen.get(col);
    values.push(neu !== undefined ? neu : (zeile[col] ?? ''));
  }
  const excelRow = row + 1;
  const addr = `${spaltenBuchstabe(min)}${excelRow}:${spaltenBuchstabe(max)}${excelRow}`;
  await graph('PATCH', `${blattPfad()}/range(address='${addr}')`, { values: [values] });
}
