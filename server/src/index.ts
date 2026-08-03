import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { ipRateKey } from './utils/ipKey.js';
import { sessionRateKey } from './middleware/session.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import setlistRoutes from './routes/setlist.js';
import siteConfigRoutes from './routes/siteConfig.js';
import annotationsRoutes from './routes/annotations.js';
import updateRoutes from './routes/update.js';

const app = express();

// Pfad zur gebauten Web-App (client/dist), relativ zu dieser Datei
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

// Hinter dem Reverse-Proxy (bei der ECG: Synology; andere Gemeinden ggf. Cloudflare Tunnel):
// X-Forwarded-Proto vertrauen, damit secure-Cookies korrekt gesetzt werden.
//
// `'loopback'` statt `1` (#214): Express überspringt damit von rechts ALLE lokalen Hops und nimmt
// den rechtesten echten Client-Eintrag – korrekt bei einem UND bei zwei lokalen Zwischenstationen.
// Mit der festen `1` hing die gesamte IP-Härtung an einer ungeprüften Annahme über die Proxy-Kette:
// Steht noch ein Hop dazwischen, wäre `req.ip` immer `127.0.0.1` → alle Anfragen der Welt teilten
// EINEN Rate-Limit-Schlüssel (eine von außen auslösbare Login-Sperre für die ganze Gemeinde).
// Wichtig fürs Login-Limit (`routes/auth.ts`), das mangels Session nur die IP hat.
if (config.isProduction) app.set('trust proxy', 'loopback');

// ── Sicherheit & Basis-Middleware ───────────────────────────
// Content-Security-Policy: In Produktion restriktiv (zusätzliche Schutzschicht gegen XSS),
// in der Entwicklung AUS – dort liefert der Vite-Dev-Server das HTML aus (mit HMR + Inline-
// Scripts/eval); eine strenge CSP würde ihn nur brechen. (#47)
//
// Der einzige erlaubte Inline-Script ist der Boot-Fallback in index.html (#32). Statt
// `script-src 'unsafe-inline'` (würde den XSS-Schutz aushebeln) erlauben wir ihn über seinen
// sha256-Hash. Der Hash wird beim Start aus der gebauten index.html berechnet – so wandert er
// automatisch mit, falls sich der Boot-Script je ändert (kein manuelles Nachpflegen).
function inlineScriptHashes(): string[] {
  try {
    const html = readFileSync(path.join(clientDist, 'index.html'), 'utf8');
    const hashes: string[] = [];
    // Nur Inline-Scripts (ohne src=…); externe /assets/*.js sind bereits über 'self' abgedeckt.
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    for (let m = re.exec(html); m; m = re.exec(html)) {
      hashes.push(`'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
    }
    return hashes;
  } catch {
    return []; // z. B. wenn (noch) kein Build vorliegt – dann greift script-src 'self'
  }
}

if (config.isProduction) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          // App-JS liegt als externe /assets/*.js (self); Boot-Fallback via Hash. Kein unsafe-inline.
          scriptSrc: ["'self'", ...inlineScriptHashes()],
          // Inline-Styles nötig: Boot-Fallback nutzt style="…" und React setzt zur Laufzeit
          // dynamische Styles (z. B. Slide-Transform beim Blättern). Style-Injektion ist ungefährlich.
          styleSrc: ["'self'", "'unsafe-inline'"],
          // Logo (base64-DataURL) + Anmerkungs-PNGs (DataURL/Blob) + gerenderte PDF-Seiten.
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'"], // System-Font, kein Web-Font
          connectSrc: ["'self'"], // Client spricht nur mit dem eigenen /api-Proxy
          workerSrc: ["'self'", 'blob:'], // pdf.js-Worker ist inline → Blob-URL
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          manifestSrc: ["'self'"],
          // BEWUSST KEIN upgrade-insecure-requests: Die App lädt ausschließlich relative,
          // same-origin Ressourcen (nichts hochzustufen), aber die Direktive würde im reinen
          // LAN-HTTP-Betrieb (Staging + Gemeinden ohne HTTPS) das App-JS auf https:// erzwingen
          // → JS lädt nicht → nur der Boot-Fallback erscheint. Über HTTPS wäre sie wirkungslos.
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
} else {
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
}
// Limit höher: Logo (base64) + Anmerkungs-Striche einer Seite (PNG-DataURL) müssen hineinpassen.
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser(config.sessionSecret));

// Allgemeines Rate-Limit – NUR auf echte API-Aktionen (`/api`), nicht auf statische
// Frontend-Dateien (JS/CSS/Icons); die zählten sonst jede beim App-Laden mit.
// Gezählt wird PRO ANGEMELDETEM NUTZER (Session-Cookie), sonst pro IP: Im Gemeinde-WLAN gehen
// alle Geräte über EINE öffentliche IP raus – ohne Nutzer-Schlüssel teilte sich das ganze Team
// ein Kontingent und lief sofort in „Too many requests". (Login bekommt zusätzlich ein strengeres.)
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    // Angemeldet zählt die SITZUNG (stabiler Schlüssel, siehe `sessionRateKey` – #194): Seit der
    // Cookie-Verschlüsselung ändert sich der rohe Cookie-Wert bei jeder Anfrage, als Schlüssel wäre
    // das Limit wirkungslos. Ohne Session der Anschluss, nicht die einzelne Adresse: `ipRateKey`
    // fasst IPv6 auf das /64-Netz zusammen (#146).
    keyGenerator: (req) => sessionRateKey(req) ?? ipRateKey(req.ip),
  }),
);

// ── Routen ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: config.nodeEnv });
});

app.use('/api/auth', authRoutes);
app.use('/api', siteConfigRoutes);
app.use('/api', updateRoutes); // öffentlich – vor den session-geschützten Routern mounten
app.use('/api', setlistRoutes);
app.use('/api', annotationsRoutes);

// ── Im Produktionsbetrieb: die gebaute Web-App ausliefern ───
if (config.isProduction) {
  app.use(express.static(clientDist));
  // SPA-Fallback: alle Nicht-API-Pfade auf index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Fehlerbehandlung (immer zuletzt) ────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server läuft auf http://localhost:${config.port} (${config.nodeEnv})`);
});

/**
 * Sauber herunterfahren (#251).
 *
 * `docker stop` schickt SIGTERM und wartet dann 10 s. Ohne Handler bricht der Prozess sofort ab –
 * eine Anmerkung oder Einstellung, die gerade in der Schreib-Kette wartet (die Schreibvorgänge sind
 * pro Konto serialisiert), wäre verloren. Der einzelne Schreibvorgang selbst ist atomar (tmp +
 * rename), es geht also nur um das Wartende. Wir nehmen keine neuen Verbindungen mehr an und lassen
 * laufende Anfragen auslaufen; nach 8 s wird hart beendet, damit ein hängender Socket den Neustart
 * nicht blockiert.
 */
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    // eslint-disable-next-line no-console
    console.log(`${sig} empfangen – Server wird beendet.`);
    // Der Watchdog darf NICHT `unref()`-t werden: Sonst hält er den Prozess nicht am Leben, feuert
    // also nie – während untätige Keep-Alive-Verbindungen ihn offen halten und `server.close()` auf
    // sie wartet. Genau das ließ den CI-Job nach 10 Sekunden Tests noch neun Minuten hängen; bei
    // `docker stop` hätte es ebenso 10 s gedauert, bis Docker mit SIGKILL nachhilft.
    const hard = setTimeout(() => process.exit(0), 8000);
    // Untätige Verbindungen sofort schließen, laufende Antworten aber zu Ende schicken – ohne das
    // wartet `close()` auf jeden Browser, der seine Verbindung offen hält.
    server.closeIdleConnections();
    server.close(() => {
      clearTimeout(hard);
      process.exit(0);
    });
  });
}

/**
 * Eine unbehandelte Promise-Ablehnung soll NICHT still verschwinden (#251): ohne Handler beendet Node
 * den Prozess je nach Version stillschweigend oder mit unklarer Meldung. Wir loggen sie und leben
 * weiter – ein einzelner fehlgeschlagener Hintergrund-Vorgang darf den Gottesdienst nicht abbrechen.
 */
process.on('unhandledRejection', (reason) => {
  console.error('[server] unbehandelte Promise-Ablehnung:', reason);
});
