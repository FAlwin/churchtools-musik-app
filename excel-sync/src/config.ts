import 'dotenv/config';

/**
 * Konfiguration des Sync-Dienstes – alles aus der Umgebung, nichts hartkodiert (Lehre aus dem
 * Alt-Planner, dessen Token im Git-Verlauf lag). Fehlt ein Pflichtwert, startet der Dienst nicht:
 * Ein halb konfigurierter Abgleich, der still nichts tut, wäre schlimmer als ein klarer Fehler.
 */
function pflicht(name: string): string {
  const v = process.env[name];
  if (v === undefined || v.trim() === '') {
    throw new Error(`Umgebungsvariable ${name} fehlt (siehe excel-sync/.env.example).`);
  }
  return v.trim();
}

function zahl(name: string, standard: number): number {
  const roh = process.env[name];
  if (roh === undefined || roh.trim() === '') return standard;
  const n = Number(roh);
  if (!Number.isFinite(n)) throw new Error(`Umgebungsvariable ${name} ist keine Zahl: ${roh}`);
  return n;
}

export const config = {
  churchtoolsBaseUrl: pflicht('CHURCHTOOLS_BASE_URL').replace(/\/$/, ''),
  churchtoolsServiceToken: pflicht('CHURCHTOOLS_SERVICE_TOKEN'),
  absenceReasonId: zahl('CHURCHTOOLS_ABSENCE_REASON_ID', 1),
  azureTenantId: pflicht('AZURE_TENANT_ID'),
  azureClientId: pflicht('AZURE_CLIENT_ID'),
  azureClientSecret: pflicht('AZURE_CLIENT_SECRET'),
  onedriveUser: pflicht('ONEDRIVE_USER'),
  excelFileId: pflicht('EXCEL_FILE_ID'),
  excelWorksheet: process.env.EXCEL_WORKSHEET?.trim() || String(new Date().getFullYear()),
  /** Standard TRUE: Der Dienst schreibt erst, wenn jemand das bewusst umstellt. */
  dryRun: (process.env.SYNC_DRY_RUN ?? 'true').toLowerCase() !== 'false',
  intervalMin: zahl('SYNC_INTERVAL_MIN', 10),
  baselinePath: process.env.SYNC_BASELINE_PATH?.trim() || './data/sync-baseline.json',
  port: zahl('PORT', 3010),
};
