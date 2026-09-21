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

/** Kürzeste Länge, die für ein Sitzungs-Geheimnis in Produktion durchgeht (`openssl rand -hex 32` = 64). */
export const SESSION_SECRET_MIN_LAENGE = 32;

/**
 * Werte, die **niemals** ein Geheimnis sein dürfen: die Vorlage aus `.env.example` und der
 * Entwicklungs-Rückfall. Sie sind öffentlich bekannt – wer sie in Produktion stehen lässt, hat
 * fälschbare Sitzungs-Cookies, und das darin verschlüsselte ChurchTools-Cookie ist lesbar.
 */
const VERBOTENE_GEHEIMNISSE = new Set([
  'bitte-langen-zufallsstring-eintragen',
  'dev-only-insecure-secret',
  'change-me',
  'changeme',
  'secret',
]);

/**
 * Prüft das Sitzungs-Geheimnis – **nur in Produktion**, und dort mit Absicht mit einem Abbruch.
 *
 * Bis zum 21.09.2026 wurde nur auf „nicht leer" geprüft (Code-Check): Die Vorlage aus `.env.example`
 * ist 36 Zeichen lang und wäre damit anstandslos durchgegangen. In der Entwicklung bleibt der
 * Komfort-Rückfall erlaubt, sonst könnte niemand mehr ohne `.env` starten.
 *
 * Der Abbruch ist bewusst: Ein Start mit bekanntem Geheimnis wäre schlimmer als ein Start, der
 * nicht stattfindet – und die Meldung sagt, was zu tun ist.
 */
export function pruefeSessionSecret(wert: string, produktion: boolean): string {
  if (!produktion) return wert;
  const nackt = wert.trim();
  if (VERBOTENE_GEHEIMNISSE.has(nackt.toLowerCase())) {
    throw new Error(
      'SESSION_SECRET ist noch der Beispielwert aus .env.example. Bitte ein eigenes Geheimnis ' +
        'erzeugen: openssl rand -hex 32',
    );
  }
  if (nackt.length < SESSION_SECRET_MIN_LAENGE) {
    throw new Error(
      `SESSION_SECRET ist zu kurz (${nackt.length} Zeichen, mindestens ` +
        `${SESSION_SECRET_MIN_LAENGE}). Neues Geheimnis erzeugen: openssl rand -hex 32`,
    );
  }
  return wert;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Pflichtfeld ohne Default: jede Instanz MUSS ihre eigene ChurchTools-URL setzen.
  // Verhindert, dass eine fehlkonfigurierte Instanz still mit einem fremden ChurchTools redet.
  churchtoolsBaseUrl: required('CHURCHTOOLS_BASE_URL'),
  // In Produktion ist ein echtes Secret PFLICHT (kein unsicherer Fallback – sonst wären
  // die signierten Session-Cookies fälschbar). Nur in der Entwicklung gibt es einen Komfort-Default.
  sessionSecret: pruefeSessionSecret(
    isProductionEnv
      ? required('SESSION_SECRET')
      : required('SESSION_SECRET', 'dev-only-insecure-secret'),
    isProductionEnv,
  ),
  // Session-Cookie nur dann mit `secure` ausliefern, wenn die Instanz AUSSCHLIESSLICH über HTTPS
  // läuft (Reverse Proxy/Cloudflare). Im reinen LAN-HTTP-Betrieb MUSS es aus bleiben, sonst
  // speichert der Browser das Cookie nicht → „nicht angemeldet". Standard: aus (unverändertes Verhalten).
  cookieSecure: (process.env.COOKIE_SECURE ?? 'false').toLowerCase() === 'true',
  /**
   * ChurchTools-Abwesenheitsgrund, den die App beim Eintragen setzt (#177). Bei der ECG ist `1` =
   * „Abwesend" (gemessen). Andere Instanzen können die Gründe anders nummeriert haben – deshalb Env.
   */
  absenceReasonId: Number(process.env.CHURCHTOOLS_ABSENCE_REASON_ID ?? 1),
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
