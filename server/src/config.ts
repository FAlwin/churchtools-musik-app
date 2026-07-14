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

const isProductionEnv = (process.env.NODE_ENV ?? 'development') === 'production';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Pflichtfeld ohne Default: jede Instanz MUSS ihre eigene ChurchTools-URL setzen.
  // Verhindert, dass eine fehlkonfigurierte Instanz still mit einem fremden ChurchTools redet.
  churchtoolsBaseUrl: required('CHURCHTOOLS_BASE_URL'),
  // In Produktion ist ein echtes Secret PFLICHT (kein unsicherer Fallback – sonst wären
  // die signierten Session-Cookies fälschbar). Nur in der Entwicklung gibt es einen Komfort-Default.
  sessionSecret: isProductionEnv
    ? required('SESSION_SECRET')
    : required('SESSION_SECRET', 'dev-only-insecure-secret'),
  // Session-Cookie nur dann mit `secure` ausliefern, wenn die Instanz AUSSCHLIESSLICH über HTTPS
  // läuft (Reverse Proxy/Cloudflare). Im reinen LAN-HTTP-Betrieb MUSS es aus bleiben, sonst
  // speichert der Browser das Cookie nicht → „nicht angemeldet". Standard: aus (unverändertes Verhalten).
  cookieSecure: (process.env.COOKIE_SECURE ?? 'false').toLowerCase() === 'true',
  /** Ablageort der Laufzeit-Branding-Datei (persistentes Docker-Volume). */
  siteConfigPath: process.env.SITE_CONFIG_PATH ?? './data/site.json',
  /** Ablageordner der kontobezogenen Anmerkungen (eine JSON-Datei je ChurchTools-Konto). */
  annotationsPath: process.env.ANNOTATIONS_PATH ?? './data/annotations',
  /**
   * Ablageort des Rechte-Caches (persistentes Docker-Volume). Merkt sich pro Konto die zuletzt
   * gültigen ChurchTools-Rechte, um sporadische CT-Aussetzer (leere Rechte-Antwort) zu überbrücken.
   */
  capabilitiesCachePath: process.env.CAPABILITIES_CACHE_PATH ?? './data/capabilities-cache.json',
  /**
   * Ablageort der „zuletzt gesehenen Setlist-Stände" je Konto (#143, persistentes Volume). Merkt
   * pro Konto+Termin den zuletzt angeschauten Setlist-Fingerabdruck → „geändert"-Badge.
   */
  seenSetlistsPath: process.env.SEEN_SETLISTS_PATH ?? './data/seen-setlists.json',
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
