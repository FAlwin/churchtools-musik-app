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
  // Pflichtfeld ohne Default: jede Instanz MUSS ihre eigene ChurchTools-URL setzen.
  // Verhindert, dass eine fehlkonfigurierte Instanz still mit einem fremden ChurchTools redet.
  churchtoolsBaseUrl: required('CHURCHTOOLS_BASE_URL'),
  sessionSecret: required('SESSION_SECRET', 'dev-only-insecure-secret'),
  /** Ablageort der Laufzeit-Branding-Datei (persistentes Docker-Volume). */
  siteConfigPath: process.env.SITE_CONFIG_PATH ?? './data/site.json',
  /**
   * ChurchTools-Recht, das als „Administrator" gilt (steuert Zugriff auf die
   * Branding-Einstellungen). Form `modul:recht`. Default deckt Voll-Admins ab;
   * je nach Instanz ggf. anpassen.
   */
  adminPermission: process.env.ADMIN_PERMISSION ?? 'churchcore:administer persons',
  get isProduction() {
    return this.nodeEnv === 'production';
  },
};
