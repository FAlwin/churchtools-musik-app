import 'dotenv/config';

/**
 * Zentrale, validierte Konfiguration aus Umgebungsvariablen.
 * Wirft beim Start einen Fehler, wenn Pflichtwerte fehlen.
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Umgebungsvariable ${name} fehlt. Bitte in .env setzen (siehe .env.example).`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  churchtoolsBaseUrl: required('CHURCHTOOLS_BASE_URL', 'https://ecg-donrath.church.tools'),
  sessionSecret: required('SESSION_SECRET', 'dev-only-insecure-secret'),
  // Optionales Service-Konto (Login-Token) für Lied-Datei-Downloads, damit auch
  // Nur-Lese-Mitglieder die Akkorde/PDFs sehen. Leer = aus (dann Nutzer-Cookie).
  songServiceToken: process.env.SONG_SERVICE_TOKEN ?? '',
  get isProduction() {
    return this.nodeEnv === 'production';
  },
};
